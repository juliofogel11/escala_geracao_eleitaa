from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import bcrypt
import jwt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI(title="Sistema de Escala Geração Eleita")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
JWT_SECRET = "escala_geracao_eleita_secret_key_2024"
JWT_ALGORITHM = "HS256"

# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"

class DayType(str, Enum):
    WEDNESDAY = "wednesday"
    FRIDAY = "friday"
    SATURDAY = "saturday"

class FunctionType(str, Enum):
    PORTARIA = "portaria"
    LIMPEZA = "limpeza"
    PREGACAO = "pregacao"
    LOUVOR = "louvor"
    INTRODUTORIA = "introdutoria"

class ResponseStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    name: str
    email: str
    role: UserRole = UserRole.USER
    created_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True

class UserCreate(BaseModel):
    username: str
    name: str
    email: str
    password: str
    role: UserRole = UserRole.USER

class UserLogin(BaseModel):
    username: str
    password: str

class Assignment(BaseModel):
    function_type: FunctionType
    user_ids: List[str] = []
    responses: Dict[str, Dict[str, Any]] = {}  # user_id -> {status, reason, timestamp}

class Schedule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD format
    day_type: DayType
    assignments: List[Assignment] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str  # admin user id
    active: bool = True

class ScheduleCreate(BaseModel):
    date: str
    day_type: DayType
    assignments: List[Assignment]

class ScheduleResponse(BaseModel):
    schedule_id: str
    function_type: FunctionType
    status: ResponseStatus
    reason: Optional[str] = None

class Notification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    schedule_id: str
    function_type: FunctionType
    date: str
    message: str
    read: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Password utilities
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

# JWT utilities
def create_jwt_token(user_id: str, role: str) -> str:
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

# Dependencies
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return User(**user)

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores.")
    return current_user

# Initialize admin user
@app.on_event("startup")
async def startup_event():
    # Create admin user if not exists
    admin_exists = await db.users.find_one({"username": "admin"})
    if not admin_exists:
        admin_user = User(
            username="admin",
            name="Administrador",
            email="admin@geracaoeleita.com",
            role=UserRole.ADMIN
        )
        admin_password = hash_password("admin123")
        user_doc = admin_user.dict()
        user_doc["password"] = admin_password
        await db.users.insert_one(user_doc)
        print("Admin user created: username=admin, password=admin123")

# Authentication routes
@api_router.post("/login")
async def login(user_login: UserLogin):
    user = await db.users.find_one({"username": user_login.username})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Credenciais inválidas")
    
    if not user["active"]:
        raise HTTPException(status_code=401, detail="Usuário desativado")
    
    token = create_jwt_token(user["id"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": User(**user).dict()
    }

@api_router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# User management routes (Admin only)
@api_router.get("/users", response_model=List[User])
async def get_users(admin_user: User = Depends(get_admin_user)):
    users = await db.users.find({}, {"password": 0}).to_list(1000)
    return [User(**user) for user in users]

@api_router.post("/users", response_model=User)
async def create_user(user_create: UserCreate, admin_user: User = Depends(get_admin_user)):
    # Check if username already exists
    existing_user = await db.users.find_one({"username": user_create.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Nome de usuário já existe")
    
    # Create new user
    user = User(
        username=user_create.username,
        name=user_create.name,
        email=user_create.email,
        role=user_create.role
    )
    
    user_doc = user.dict()
    user_doc["password"] = hash_password(user_create.password)
    
    await db.users.insert_one(user_doc)
    return user

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, admin_user: User = Depends(get_admin_user)):
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return {"message": "Usuário excluído com sucesso"}

# Schedule management routes
@api_router.get("/schedules", response_model=List[Schedule])
async def get_schedules(current_user: User = Depends(get_current_user)):
    schedules = await db.schedules.find({"active": True}).sort("date", -1).to_list(1000)
    return [Schedule(**schedule) for schedule in schedules]

@api_router.post("/schedules", response_model=Schedule)
async def create_schedule(schedule_create: ScheduleCreate, admin_user: User = Depends(get_admin_user)):
    schedule = Schedule(
        date=schedule_create.date,
        day_type=schedule_create.day_type,
        assignments=schedule_create.assignments,
        created_by=admin_user.id
    )
    
    await db.schedules.insert_one(schedule.dict())
    
    # Create notifications for assigned users
    for assignment in schedule.assignments:
        for user_id in assignment.user_ids:
            notification = Notification(
                user_id=user_id,
                schedule_id=schedule.id,
                function_type=assignment.function_type,
                date=schedule.date,
                message=f"Você foi escalado(a) para {assignment.function_type.value} no dia {schedule.date}"
            )
            await db.notifications.insert_one(notification.dict())
    
    return schedule

@api_router.put("/schedules/{schedule_id}", response_model=Schedule)
async def update_schedule(schedule_id: str, schedule_update: ScheduleCreate, admin_user: User = Depends(get_admin_user)):
    # Check if schedule exists
    existing_schedule = await db.schedules.find_one({"id": schedule_id, "active": True})
    if not existing_schedule:
        raise HTTPException(status_code=404, detail="Escala não encontrada")
    
    # Update schedule
    update_data = {
        "date": schedule_update.date,
        "day_type": schedule_update.day_type,
        "assignments": [assignment.dict() for assignment in schedule_update.assignments]
    }
    
    result = await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Erro ao atualizar escala")
    
    # Get updated schedule
    updated_schedule = await db.schedules.find_one({"id": schedule_id})
    
    # Remove old notifications for this schedule
    await db.notifications.delete_many({"schedule_id": schedule_id})
    
    # Create new notifications for assigned users
    for assignment in schedule_update.assignments:
        for user_id in assignment.user_ids:
            notification = Notification(
                user_id=user_id,
                schedule_id=schedule_id,
                function_type=assignment.function_type,
                date=schedule_update.date,
                message=f"Você foi escalado(a) para {assignment.function_type.value} no dia {schedule_update.date} (escala atualizada)"
            )
            await db.notifications.insert_one(notification.dict())
    
    return Schedule(**updated_schedule)

@api_router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, admin_user: User = Depends(get_admin_user)):
    result = await db.schedules.update_one(
        {"id": schedule_id},
        {"$set": {"active": False}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Escala não encontrada")
    return {"message": "Escala excluída com sucesso"}

# Schedule response routes
@api_router.post("/schedule-response")
async def respond_to_schedule(response: ScheduleResponse, current_user: User = Depends(get_current_user)):
    schedule = await db.schedules.find_one({"id": response.schedule_id})
    if not schedule:
        raise HTTPException(status_code=404, detail="Escala não encontrada")
    
    # Update the user's response in the schedule
    updated = False
    for assignment in schedule["assignments"]:
        if assignment["function_type"] == response.function_type and current_user.id in assignment["user_ids"]:
            if "responses" not in assignment:
                assignment["responses"] = {}
            assignment["responses"][current_user.id] = {
                "status": response.status,
                "reason": response.reason,
                "timestamp": datetime.utcnow().isoformat()
            }
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=400, detail="Você não está escalado para esta função")
    
    await db.schedules.update_one(
        {"id": response.schedule_id},
        {"$set": {"assignments": schedule["assignments"]}}
    )
    
    return {"message": "Resposta registrada com sucesso"}

# Notification routes
@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(current_user: User = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": current_user.id}).sort("created_at", -1).to_list(100)
    return [Notification(**notification) for notification in notifications]

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, current_user: User = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user.id},
        {"$set": {"read": True}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    return {"message": "Notificação marcada como lida"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()