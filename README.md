# Simulant - AI-Powered QA Testing Platform

Professional website testing powered by 5 specialized AI agents.

## Features

- **5 AI Testing Agents**: Performance, Accessibility, Security, QA, Mobile
- **Real-time Updates**: WebSocket streaming of test progress
- **Professional Reports**: Severity ratings, impact analysis, fix recommendations
- **Parallel Execution**: All agents run simultaneously
- **Vision AI**: Screenshot analysis using GPT-4 Vision

## Tech Stack

**Frontend:**
- Next.js 14
- TypeScript
- Tailwind CSS
- Clerk Authentication
- Framer Motion

**Backend:**
- FastAPI
- SQLAlchemy (SQLite/PostgreSQL)
- Playwright for browser automation
- OpenRouter AI (Grok Vision)
- WebSocket real-time updates

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
playwright install chromium

# Create .env file
cp .env.example .env
# Add your OPENROUTER_API_KEY

python main.py
```

### Frontend

```bash
cd frontend
npm install

# Create .env.local file
cp .env.local.example .env.local
# Add your Clerk keys

npm run dev
```

## Environment Variables

### Backend (.env)
```
OPENROUTER_API_KEY=sk-or-xxxxx
DATABASE_URL=sqlite+aiosqlite:///./simulant.db
```

### Frontend (.env.local)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Deployment

- **Frontend**: Deploy to Vercel
- **Backend**: Deploy to Railway with Dockerfile

## License

MIT
