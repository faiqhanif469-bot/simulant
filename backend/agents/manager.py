"""
Agent Manager - Orchestrates parallel testing with cancellation support
"""
import asyncio
from typing import List, Callable, Dict, Any
from .persona_agent import PersonaAgent
from database import async_session
from database.models import Test, TestResult


class AgentManager:
    """Manages parallel agent execution with cancellation"""
    
    def __init__(self):
        self.broadcast: Callable = None
        self.active_tests: Dict[int, Dict] = {}
        self.rate_limiter = asyncio.Semaphore(3)
    
    async def run_test(self, test_id: int, url: str, personas: List[str]):
        """Run test with all selected agents"""
        
        # Track test
        agents = {}
        self.active_tests[test_id] = {
            "url": url,
            "personas": personas,
            "status": "running",
            "agents": agents
        }
        
        # Update DB status
        async with async_session() as db:
            from sqlalchemy import select
            result = await db.execute(select(Test).where(Test.id == test_id))
            test = result.scalar_one()
            test.status = "running"
            await db.commit()
        
        # Broadcast start
        if self.broadcast:
            await self.broadcast(test_id, {"type": "test_started", "personas": personas})
        
        # Create agents
        for persona in personas:
            agent = PersonaAgent(persona)
            agents[persona] = agent
        
        # Run all agents
        tasks = [
            self._run_agent(test_id, url, persona, agents[persona])
            for persona in personas
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Calculate summary
        all_bugs = []
        for result in results:
            if isinstance(result, dict):
                all_bugs.extend(result.get("bugs_found", []))
        
        total_bugs = len(all_bugs)
        critical = len([b for b in all_bugs if b.get("severity") == "critical"])
        high = len([b for b in all_bugs if b.get("severity") == "high"])
        
        # Update DB
        was_cancelled = self.active_tests.get(test_id, {}).get("status") == "cancelled"
        async with async_session() as db:
            from sqlalchemy import select
            result = await db.execute(select(Test).where(Test.id == test_id))
            test = result.scalar_one()
            test.status = "cancelled" if was_cancelled else "completed"
            await db.commit()
        
        # Broadcast completion
        if self.broadcast:
            await self.broadcast(test_id, {
                "type": "test_completed",
                "test_id": test_id,
                "was_cancelled": was_cancelled,
                "summary": {
                    "total_bugs": total_bugs,
                    "critical": critical,
                    "high": high
                }
            })
        
        # Cleanup
        if test_id in self.active_tests:
            del self.active_tests[test_id]
    
    async def _run_agent(self, test_id: int, url: str, persona: str, agent: PersonaAgent) -> Dict:
        """Run single agent with rate limiting"""
        
        async with self.rate_limiter:
            # Create DB record
            async with async_session() as db:
                result = TestResult(
                    test_id=test_id,
                    persona=persona,
                    status="running"
                )
                db.add(result)
                await db.commit()
                await db.refresh(result)
                result_id = result.id
            
            # Broadcast start
            if self.broadcast:
                await self.broadcast(test_id, {"type": "persona_started", "persona": persona})
            
            try:
                # Setup update callback
                async def on_update(event_type: str, data: dict):
                    if self.broadcast:
                        await self.broadcast(test_id, {
                            "type": event_type,
                            "persona": persona,
                            **data
                        })
                
                agent.on_update = on_update
                
                # Run test
                result_data = await agent.test_site(url)
                
                # Save results
                async with async_session() as db:
                    from sqlalchemy import select
                    res = await db.execute(select(TestResult).where(TestResult.id == result_id))
                    result = res.scalar_one()
                    result.status = result_data.get("status", "completed")
                    result.bugs_found = result_data.get("bugs_found", [])
                    result.quality_score = result_data.get("quality_score", 0)
                    result.summary = result_data.get("summary", "")
                    result.actions_taken = len(result_data.get("phases_completed", []))
                    await db.commit()
                
                # Broadcast completion
                if self.broadcast:
                    await self.broadcast(test_id, {
                        "type": "persona_completed",
                        "persona": persona,
                        "bugs_count": len(result_data.get("bugs_found", [])),
                        "quality_score": result_data.get("quality_score", 0),
                        "was_cancelled": result_data.get("was_cancelled", False)
                    })
                
                return result_data
                
            except Exception as e:
                error_msg = str(e)[:200]
                
                async with async_session() as db:
                    from sqlalchemy import select
                    res = await db.execute(select(TestResult).where(TestResult.id == result_id))
                    result = res.scalar_one()
                    result.status = "failed"
                    result.summary = f"Error: {error_msg}"
                    await db.commit()
                
                if self.broadcast:
                    await self.broadcast(test_id, {
                        "type": "persona_failed",
                        "persona": persona,
                        "error": error_msg
                    })
                
                return {"bugs_found": [], "quality_score": 0}
    
    async def cancel_test(self, test_id: int) -> bool:
        """Cancel a running test - agents will finish current work and generate reports"""
        if test_id not in self.active_tests:
            return False
        
        self.active_tests[test_id]["status"] = "cancelled"
        
        # Signal all agents to stop
        agents = self.active_tests[test_id].get("agents", {})
        for agent in agents.values():
            agent.cancel()
        
        if self.broadcast:
            await self.broadcast(test_id, {
                "type": "test_cancelling",
                "message": "Stopping test, generating reports for completed work..."
            })
        
        return True
    
    def get_active_tests(self) -> Dict[int, Dict]:
        """Get running tests"""
        return {k: {"url": v["url"], "status": v["status"]} for k, v in self.active_tests.items()}
