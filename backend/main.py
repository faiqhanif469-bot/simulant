"""
Simulant Backend API
Professional AI-powered website testing
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Optional
import asyncio
from datetime import datetime

from database import init_db, async_session
from database.models import Test, TestResult
from agents.manager import AgentManager

# Beta limits
BETA_END_DATE = datetime(2024, 12, 13, 23, 59, 59)
FREE_TEST_LIMIT = 5

app = FastAPI(
    title="Simulant API",
    version="1.0.0",
    description="Professional AI-powered website testing"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections: dict = {}
agent_manager = AgentManager()


@app.on_event("startup")
async def startup():
    await init_db()


# --- Request/Response Models ---
class TestRequest(BaseModel):
    url: str
    personas: List[str]
    user_id: str = "anonymous"
    
    @validator('url')
    def validate_url(cls, v):
        if not v:
            raise ValueError('URL is required')
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL must start with http:// or https://')
        if len(v) > 2000:
            raise ValueError('URL too long')
        return v.strip()
    
    @validator('personas')
    def validate_personas(cls, v):
        valid = {'jake', 'grandma', 'alex', 'priya', 'marcus'}
        invalid = [p for p in v if p not in valid]
        if invalid:
            raise ValueError(f'Invalid personas: {invalid}')
        if not v:
            raise ValueError('Select at least one agent')
        if len(v) > 5:
            raise ValueError('Maximum 5 agents')
        return v


class TestResponse(BaseModel):
    test_id: int
    status: str
    message: str = ""


class ErrorResponse(BaseModel):
    detail: str


# --- Endpoints ---
@app.get("/")
async def root():
    return {
        "name": "Simulant API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/agents")
async def get_agents():
    """Get available testing agents"""
    return {
        "agents": [
            {"id": "jake", "name": "Jake", "role": "Performance Analyst", "focus": "Speed, load times"},
            {"id": "grandma", "name": "Rose", "role": "Accessibility Analyst", "focus": "Usability, a11y"},
            {"id": "alex", "name": "Alex", "role": "Security Analyst", "focus": "Vulnerabilities"},
            {"id": "priya", "name": "Priya", "role": "QA Analyst", "focus": "Functionality, bugs"},
            {"id": "marcus", "name": "Marcus", "role": "Mobile Analyst", "focus": "Responsive, mobile UX"},
        ]
    }


@app.post("/test/start", response_model=TestResponse, responses={400: {"model": ErrorResponse}})
async def start_test(request: TestRequest):
    """Start a new test"""
    
    # Check if beta has ended
    if datetime.utcnow() > BETA_END_DATE:
        raise HTTPException(
            status_code=403, 
            detail="Beta period has ended. Paid plans coming soon!"
        )
    
    # Check user's test count
    async with async_session() as db:
        from sqlalchemy import select, func
        
        user_id = request.user_id[:100] if request.user_id else "anonymous"
        
        # Count user's tests
        result = await db.execute(
            select(func.count(Test.id)).where(Test.user_id == user_id)
        )
        test_count = result.scalar() or 0
        
        if test_count >= FREE_TEST_LIMIT:
            raise HTTPException(
                status_code=403,
                detail=f"Free tier limit reached ({FREE_TEST_LIMIT} tests). Paid plans coming soon!"
            )
    
    try:
        async with async_session() as db:
            test = Test(
                user_id=user_id,
                url=request.url,
                personas=request.personas,
                status="pending"
            )
            db.add(test)
            await db.commit()
            await db.refresh(test)
            
            asyncio.create_task(
                agent_manager.run_test(test.id, request.url, request.personas)
            )
            
            remaining = FREE_TEST_LIMIT - test_count - 1
            return TestResponse(
                test_id=test.id,
                status="started",
                message=f"Test started. {remaining} free tests remaining."
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start test: {str(e)[:100]}")


@app.post("/test/{test_id}/cancel")
async def cancel_test(test_id: int):
    """Cancel a running test - generates report for completed work"""
    async with async_session() as db:
        from sqlalchemy import select
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        if test.status in ["completed", "cancelled", "failed"]:
            return {"status": test.status, "message": "Test already finished"}
    
    cancelled = await agent_manager.cancel_test(test_id)
    if cancelled:
        return {"status": "cancelling", "message": "Test is being cancelled. Reports will be generated for completed work."}
    
    return {"status": "completed", "message": "Test already finished or not running"}


@app.get("/test/{test_id}")
async def get_test(test_id: int):
    """Get test results"""
    async with async_session() as db:
        from sqlalchemy import select
        
        result = await db.execute(select(Test).where(Test.id == test_id))
        test = result.scalar_one_or_none()
        
        if not test:
            raise HTTPException(status_code=404, detail="Test not found")
        
        results_query = await db.execute(
            select(TestResult).where(TestResult.test_id == test_id)
        )
        results = results_query.scalars().all()
        
        all_bugs = []
        for r in results:
            all_bugs.extend(r.bugs_found or [])
        
        return {
            "id": test.id,
            "url": test.url,
            "status": test.status,
            "personas": test.personas,
            "created_at": test.created_at.isoformat(),
            "summary": {
                "total_bugs": len(all_bugs),
                "critical": len([b for b in all_bugs if b.get("severity") == "critical"]),
                "high": len([b for b in all_bugs if b.get("severity") == "high"]),
                "medium": len([b for b in all_bugs if b.get("severity") == "medium"]),
                "low": len([b for b in all_bugs if b.get("severity") == "low"]),
                "avg_score": round(sum(r.quality_score or 0 for r in results) / max(len(results), 1), 1)
            },
            "results": [
                {
                    "persona": r.persona,
                    "status": r.status,
                    "bugs_found": r.bugs_found or [],
                    "quality_score": r.quality_score,
                    "summary": r.summary
                }
                for r in results
            ]
        }


@app.get("/test/{test_id}/bugs")
async def get_bugs(test_id: int, severity: Optional[str] = None):
    """Get all bugs from a test"""
    async with async_session() as db:
        from sqlalchemy import select
        
        results = await db.execute(
            select(TestResult).where(TestResult.test_id == test_id)
        )
        
        bugs = []
        for r in results.scalars():
            for bug in (r.bugs_found or []):
                bug["found_by"] = r.persona
                if severity is None or bug.get("severity") == severity:
                    bugs.append(bug)
        
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        bugs.sort(key=lambda b: order.get(b.get("severity", "low"), 4))
        
        return {"test_id": test_id, "total": len(bugs), "bugs": bugs}


@app.get("/tests")
async def get_tests(user_id: str = "anonymous", limit: int = 20):
    """Get test history"""
    async with async_session() as db:
        from sqlalchemy import select
        
        result = await db.execute(
            select(Test)
            .where(Test.user_id == user_id)
            .order_by(Test.created_at.desc())
            .limit(min(limit, 100))
        )
        
        return {
            "tests": [
                {
                    "id": t.id,
                    "url": t.url,
                    "status": t.status,
                    "personas": t.personas,
                    "created_at": t.created_at.isoformat()
                }
                for t in result.scalars()
            ]
        }


@app.get("/usage/{user_id}")
async def get_usage(user_id: str):
    """Get user's usage and limits"""
    async with async_session() as db:
        from sqlalchemy import select, func
        
        result = await db.execute(
            select(func.count(Test.id)).where(Test.user_id == user_id)
        )
        test_count = result.scalar() or 0
        
        beta_active = datetime.utcnow() <= BETA_END_DATE
        
        return {
            "tests_used": test_count,
            "tests_limit": FREE_TEST_LIMIT,
            "tests_remaining": max(0, FREE_TEST_LIMIT - test_count),
            "beta_active": beta_active,
            "beta_ends": BETA_END_DATE.isoformat(),
            "plan": "free_beta"
        }


# --- WebSocket ---
@app.websocket("/ws/{test_id}")
async def websocket_endpoint(websocket: WebSocket, test_id: int):
    await websocket.accept()
    active_connections[test_id] = websocket
    
    await websocket.send_json({"type": "connected", "test_id": test_id})
    
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "keepalive"})
    except WebSocketDisconnect:
        pass
    finally:
        active_connections.pop(test_id, None)


async def broadcast_update(test_id: int, data: dict):
    """Send update to client"""
    ws = active_connections.get(test_id)
    if ws:
        try:
            await ws.send_json(data)
        except:
            active_connections.pop(test_id, None)


agent_manager.broadcast = broadcast_update


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
