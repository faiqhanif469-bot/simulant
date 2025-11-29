"""Database Models"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Test(Base):
    """A test run by a user"""
    __tablename__ = "tests"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), index=True, nullable=False)  # Clerk user ID
    url = Column(String(500), nullable=False)
    status = Column(String(50), default="pending")  # pending, running, completed, cancelled, failed
    personas = Column(JSON)  # List of persona IDs
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    results = relationship("TestResult", back_populates="test", cascade="all, delete-orphan")


class TestResult(Base):
    """Results from one agent's test"""
    __tablename__ = "test_results"
    
    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(Integer, ForeignKey("tests.id", ondelete="CASCADE"), nullable=False)
    persona = Column(String(50), nullable=False)  # jake, grandma, alex, priya, marcus
    status = Column(String(50), default="pending")  # pending, running, completed, cancelled, failed
    bugs_found = Column(JSON, default=list)  # List of bug objects
    quality_score = Column(Integer, nullable=True)  # 0-10
    summary = Column(Text, nullable=True)
    actions_taken = Column(Integer, default=0)
    pages_visited = Column(Integer, default=1)
    test_duration = Column(Integer, nullable=True)  # seconds
    metrics = Column(JSON, default=dict)  # Performance metrics
    created_at = Column(DateTime, default=datetime.utcnow)
    
    test = relationship("Test", back_populates="results")
