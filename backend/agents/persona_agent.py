"""
Persona Agent - Professional AI Website Testing
Structured, thorough testing with actionable reports
"""
import asyncio
import base64
import json
import os
import re
import time
import tempfile
from pathlib import Path
from typing import Callable, Optional, List, Dict, Any
from openai import OpenAI
from playwright.async_api import async_playwright, Page

from config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL, MODEL_NAME

# Test phases each agent must complete
TEST_PHASES = [
    "initial_load",      # Page load analysis
    "navigation",        # Test main navigation
    "forms",            # Test any forms
    "interactions",     # Test buttons, links
    "content",          # Content quality check
    "final_review"      # Overall assessment
]

PERSONAS = {
    "jake": {
        "name": "Jake",
        "role": "Performance Analyst",
        "focus": "Speed, load times, responsiveness",
        "checklist": [
            "Measure initial page load time",
            "Check for render-blocking resources",
            "Test interaction responsiveness",
            "Look for unnecessary loading states",
            "Check image optimization",
            "Test with simulated slow connection"
        ],
        "prompt": """You are a Performance Analyst. Your job is to identify performance issues that hurt user experience.

TESTING METHODOLOGY:
1. Measure page load time - anything over 3 seconds is problematic
2. Check for layout shifts during loading
3. Identify slow interactions (buttons, forms)
4. Look for unoptimized images (large file sizes, no lazy loading)
5. Check for excessive JavaScript blocking render

REPORT FORMAT - Be specific and actionable:
- State the exact issue
- Provide the measured metric (e.g., "4.2 second load time")
- Explain user impact
- Suggest fix if obvious

DO NOT report vague issues. Every bug must have evidence."""
    },
    
    "grandma": {
        "name": "Rose", 
        "role": "Accessibility & Usability Analyst",
        "focus": "Accessibility, clarity, ease of use",
        "checklist": [
            "Check text readability (size, contrast)",
            "Verify all images have alt text",
            "Test keyboard navigation",
            "Check for clear labels on forms",
            "Verify error messages are helpful",
            "Look for confusing UI patterns"
        ],
        "prompt": """You are an Accessibility & Usability Analyst. Your job is to ensure the site is usable by everyone.

TESTING METHODOLOGY:
1. Check WCAG compliance basics (contrast, alt text, labels)
2. Verify keyboard navigation works
3. Look for confusing terminology or icons
4. Check form labels and error messages
5. Verify text is readable (minimum 16px for body)

REPORT FORMAT - Be specific and actionable:
- Identify the exact element with the issue
- Reference WCAG guideline if applicable
- Explain who is affected (screen reader users, elderly, etc.)
- Provide specific fix recommendation

Focus on real accessibility barriers, not minor preferences."""
    },
    
    "alex": {
        "name": "Alex",
        "role": "Security Analyst", 
        "focus": "Vulnerabilities, data exposure, input validation",
        "checklist": [
            "Test input fields for XSS vulnerability",
            "Check for SQL injection in forms",
            "Look for exposed sensitive data",
            "Verify HTTPS is enforced",
            "Check for information disclosure in errors",
            "Test authentication flows if present"
        ],
        "prompt": """You are a Security Analyst. Your job is to identify security vulnerabilities.

TESTING METHODOLOGY:
1. Test all input fields with: <script>alert(1)</script>
2. Test login/search with: ' OR '1'='1
3. Check page source for exposed API keys, tokens
4. Verify forms use CSRF protection
5. Check if sensitive data is in URL parameters
6. Look for detailed error messages exposing system info

REPORT FORMAT - Be specific and actionable:
- Describe the vulnerability type (XSS, SQLi, etc.)
- Show the exact payload that worked or the exposure found
- Rate severity: Critical (data breach risk), High (exploit possible), Medium (information disclosure), Low (best practice)
- Provide remediation steps

Only report confirmed or highly likely vulnerabilities."""
    },
    
    "priya": {
        "name": "Priya",
        "role": "QA Analyst",
        "focus": "Functionality, edge cases, user flows",
        "checklist": [
            "Test primary user flow end-to-end",
            "Submit forms with empty fields",
            "Submit forms with invalid data",
            "Test all navigation links",
            "Check for broken images",
            "Verify error handling"
        ],
        "prompt": """You are a QA Analyst. Your job is to find functional bugs and broken user experiences.

TESTING METHODOLOGY:
1. Identify the main user flow and test it completely
2. Test forms: empty submission, invalid email, special characters
3. Click all visible buttons and links
4. Check for console errors
5. Verify success/error feedback is shown
6. Test edge cases (very long input, unicode, etc.)

REPORT FORMAT - Be specific and actionable:
- Describe exact steps to reproduce
- State expected vs actual behavior
- Include any error messages shown
- Rate severity based on user impact

Focus on bugs that break functionality, not cosmetic issues."""
    },
    
    "marcus": {
        "name": "Marcus",
        "role": "Mobile Experience Analyst",
        "focus": "Responsive design, touch interactions, mobile UX",
        "checklist": [
            "Check viewport meta tag",
            "Test touch target sizes (min 44px)",
            "Look for horizontal scroll",
            "Verify text is readable without zoom",
            "Test mobile navigation",
            "Check for fixed elements blocking content"
        ],
        "prompt": """You are a Mobile Experience Analyst. Your job is to ensure the site works well on mobile devices.

TESTING METHODOLOGY:
1. Check viewport is properly configured
2. Verify no horizontal scrolling
3. Test all tap targets are at least 44x44px
4. Check text is readable (min 16px)
5. Test mobile menu/navigation
6. Look for elements that overflow or get cut off

REPORT FORMAT - Be specific and actionable:
- Identify the exact element with the issue
- Provide measurements where relevant (e.g., "button is 28px, should be 44px")
- Explain impact on mobile users
- Suggest specific CSS/layout fix

Test as if using the site with one thumb on a phone."""
    }
}


class PersonaAgent:
    """Professional website tester with structured methodology"""
    
    def __init__(self, persona_id: str):
        self.persona = PERSONAS.get(persona_id, PERSONAS["priya"])
        self.persona_id = persona_id
        self.client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=OPENROUTER_API_KEY)
        self.on_update: Optional[Callable] = None
        self.bugs: List[Dict] = []
        self.test_log: List[Dict] = []
        self.screenshots_dir: Optional[Path] = None
        self.cancelled = False
        self.current_phase = ""
        self.phases_completed: List[str] = []
        self.page_data: Dict = {}
        
    def cancel(self):
        """Cancel the test - will generate report for completed work"""
        self.cancelled = True
        
    async def test_site(self, url: str, max_actions: int = 12) -> dict:
        """Run structured test on website"""
        
        start_time = time.time()
        
        # Create temp directory for screenshots
        self.screenshots_dir = Path(tempfile.mkdtemp(prefix="simulant_"))
        
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                context = await browser.new_context(**self._get_context_options())
                page = await context.new_page()
                
                # Setup error tracking
                console_errors = []
                page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
                
                # Phase 1: Initial Load
                self.current_phase = "initial_load"
                await self._broadcast("phase", {"phase": "Loading page..."})
                
                load_start = time.time()
                try:
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    load_time = round(time.time() - load_start, 2)
                    self.page_data["load_time"] = load_time
                    self.page_data["console_errors"] = console_errors
                except Exception as e:
                    self._add_bug({
                        "title": "Page failed to load",
                        "severity": "critical",
                        "description": f"The page at {url} failed to load within 30 seconds.",
                        "impact": "Users cannot access the site at all.",
                        "recommendation": f"Check server status and error: {str(e)[:100]}"
                    })
                    return self._generate_report(time.time() - start_time)
                
                if self.cancelled:
                    return self._generate_report(time.time() - start_time)
                
                # Get page info
                self.page_data.update(await self._get_page_info(page))
                
                # Take initial screenshot and analyze
                screenshot = await self._take_screenshot(page, "initial")
                await self._analyze_phase(screenshot, "initial_load", page.url)
                self.phases_completed.append("initial_load")
                
                # Phase 2-5: Structured testing based on checklist
                action_count = 0
                
                for phase in ["navigation", "forms", "interactions", "content"]:
                    if self.cancelled:
                        break
                        
                    self.current_phase = phase
                    await self._broadcast("phase", {"phase": f"Testing {phase}..."})
                    
                    # Get next action based on phase
                    for _ in range(3):  # Max 3 actions per phase
                        if self.cancelled or action_count >= max_actions:
                            break
                            
                        screenshot = await self._take_screenshot(page, f"{phase}_{action_count}")
                        
                        action_result = await self._get_phase_action(screenshot, phase, page.url)
                        if not action_result:
                            break
                            
                        # Log thought
                        if action_result.get("thought"):
                            await self._broadcast("action", {"thought": action_result["thought"]})
                        
                        # Record bugs
                        for bug in action_result.get("bugs", []):
                            self._add_bug(bug)
                        
                        # Execute action
                        action = action_result.get("action", {})
                        if action.get("type") == "done" or action.get("type") == "skip":
                            break
                            
                        await self._execute_action(page, action)
                        action_count += 1
                        await asyncio.sleep(0.3)
                    
                    self.phases_completed.append(phase)
                
                # Phase 6: Final Review
                if not self.cancelled:
                    self.current_phase = "final_review"
                    await self._broadcast("phase", {"phase": "Final review..."})
                    screenshot = await self._take_screenshot(page, "final")
                    await self._final_review(screenshot, page.url)
                    self.phases_completed.append("final_review")
                
                await browser.close()
                
        finally:
            # Cleanup screenshots
            self._cleanup_screenshots()
        
        return self._generate_report(time.time() - start_time)
    
    def _get_context_options(self) -> dict:
        """Browser context options based on persona"""
        if self.persona_id == "marcus":
            return {
                "viewport": {"width": 375, "height": 812},
                "device_scale_factor": 3,
                "is_mobile": True,
                "has_touch": True,
                "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
            }
        return {"viewport": {"width": 1920, "height": 1080}}
    
    async def _take_screenshot(self, page: Page, name: str) -> str:
        """Take screenshot and return base64"""
        try:
            path = self.screenshots_dir / f"{name}.png"
            await page.screenshot(path=str(path), full_page=False)
            with open(path, "rb") as f:
                return base64.b64encode(f.read()).decode()
        except:
            return ""
    
    def _cleanup_screenshots(self):
        """Remove temporary screenshots"""
        if self.screenshots_dir and self.screenshots_dir.exists():
            import shutil
            shutil.rmtree(self.screenshots_dir, ignore_errors=True)
    
    async def _get_page_info(self, page: Page) -> dict:
        """Extract page information for context"""
        try:
            return await page.evaluate("""() => ({
                title: document.title,
                url: location.href,
                hasViewport: !!document.querySelector('meta[name="viewport"]'),
                formCount: document.forms.length,
                linkCount: document.querySelectorAll('a').length,
                buttonCount: document.querySelectorAll('button').length,
                imageCount: document.images.length,
                imagesWithoutAlt: Array.from(document.images).filter(i => !i.alt).length,
                h1Text: document.querySelector('h1')?.innerText?.slice(0, 100) || '',
                bodyFontSize: getComputedStyle(document.body).fontSize
            })""")
        except:
            return {}

    
    async def _analyze_phase(self, screenshot: str, phase: str, url: str):
        """Analyze current phase"""
        
        checklist_items = self.persona.get("checklist", [])
        
        prompt = f"""You are {self.persona['name']}, a {self.persona['role']}.
{self.persona['prompt']}

CURRENT PHASE: {phase}
URL: {url}
PAGE DATA: Load time: {self.page_data.get('load_time', 'N/A')}s, Forms: {self.page_data.get('formCount', 0)}, Links: {self.page_data.get('linkCount', 0)}

YOUR CHECKLIST FOR THIS PHASE:
{chr(10).join(f"- {item}" for item in checklist_items[:3])}

Analyze the screenshot. Report any issues you find.

Respond in JSON:
```json
{{
    "thought": "Brief analysis of what you see",
    "bugs": [
        {{
            "title": "Clear, specific title",
            "severity": "critical/high/medium/low",
            "description": "What is wrong and evidence",
            "impact": "How this affects users",
            "recommendation": "How to fix it"
        }}
    ]
}}
```

Only report real issues with evidence. No speculation."""

        result = await self._call_ai(prompt, screenshot)
        if result:
            for bug in result.get("bugs", []):
                self._add_bug(bug)
    
    async def _get_phase_action(self, screenshot: str, phase: str, url: str) -> Optional[dict]:
        """Decide next action for current phase"""
        
        phase_instructions = {
            "navigation": "Test the main navigation. Click menu items, check if links work.",
            "forms": "Find and test forms. Try submitting empty, test validation.",
            "interactions": "Test buttons, dropdowns, interactive elements.",
            "content": "Review content quality, check for broken images, typos."
        }
        
        prompt = f"""You are {self.persona['name']}, a {self.persona['role']}.
{self.persona['prompt']}

CURRENT PHASE: {phase}
INSTRUCTION: {phase_instructions.get(phase, '')}
URL: {url}

Look at the screenshot. What should you test next?

Respond in JSON:
```json
{{
    "thought": "What you're checking and why",
    "bugs": [],
    "action": {{
        "type": "click/type/scroll/skip/done",
        "target": "Text of element to interact with",
        "text": "Text to type if type action"
    }}
}}
```

Use "skip" if nothing relevant for this phase. Use "done" if phase is complete."""

        return await self._call_ai(prompt, screenshot)
    
    async def _final_review(self, screenshot: str, url: str):
        """Generate final professional review"""
        
        bugs_summary = f"Found {len(self.bugs)} issues so far."
        if self.bugs:
            by_severity = {}
            for b in self.bugs:
                sev = b.get("severity", "medium")
                by_severity[sev] = by_severity.get(sev, 0) + 1
            bugs_summary += f" Breakdown: {by_severity}"
        
        prompt = f"""You are {self.persona['name']}, a {self.persona['role']}.

FINAL REVIEW for {url}

{bugs_summary}

Phases completed: {', '.join(self.phases_completed)}

Look at the screenshot one final time. Are there any issues you missed?
Focus on your specialty: {self.persona['focus']}

Respond in JSON:
```json
{{
    "thought": "Final observations",
    "bugs": [],
    "overall_assessment": "One paragraph professional summary of site quality from your perspective"
}}
```"""

        result = await self._call_ai(prompt, screenshot)
        if result:
            for bug in result.get("bugs", []):
                self._add_bug(bug)
            self.page_data["assessment"] = result.get("overall_assessment", "")
    
    async def _execute_action(self, page: Page, action: dict) -> bool:
        """Execute action on page"""
        action_type = action.get("type", "")
        target = action.get("target", "")
        
        try:
            if action_type == "click" and target:
                for selector in [
                    page.get_by_text(target, exact=False).first,
                    page.get_by_role("button", name=target).first,
                    page.get_by_role("link", name=target).first,
                ]:
                    try:
                        await selector.click(timeout=3000)
                        return True
                    except:
                        continue
                return False
                
            elif action_type == "type":
                text = action.get("text", "test@example.com")
                try:
                    await page.locator("input:visible").first.fill(text, timeout=2000)
                    return True
                except:
                    return False
                    
            elif action_type == "scroll":
                await page.evaluate("window.scrollBy(0, 400)")
                return True
                
        except Exception as e:
            self.test_log.append({"action": action, "error": str(e)})
            return False
        
        return True
    
    async def _call_ai(self, prompt: str, screenshot: str) -> Optional[dict]:
        """Call AI with retry"""
        for attempt in range(2):
            try:
                messages = [{"role": "user", "content": [{"type": "text", "text": prompt}]}]
                if screenshot:
                    messages[0]["content"].append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{screenshot}"}
                    })
                
                response = self.client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    temperature=0.3,
                    max_tokens=1500
                )
                
                content = response.choices[0].message.content
                match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
                if match:
                    return json.loads(match.group(1))
                match = re.search(r'\{[\s\S]*\}', content)
                if match:
                    return json.loads(match.group())
                    
            except Exception as e:
                if attempt == 1:
                    print(f"AI call failed: {e}")
                await asyncio.sleep(0.5)
        
        return None
    
    def _add_bug(self, bug: dict):
        """Add bug with deduplication"""
        if not bug.get("title"):
            return
        for existing in self.bugs:
            if existing.get("title") == bug.get("title"):
                return
        bug["found_by"] = self.persona["name"]
        bug["phase"] = self.current_phase
        self.bugs.append(bug)
        
        if self.on_update:
            asyncio.create_task(self._broadcast("bug_found", {"bug": bug}))
    
    async def _broadcast(self, event_type: str, data: dict):
        """Send update"""
        if self.on_update:
            await self.on_update(event_type, data)
    
    def _generate_report(self, duration: float) -> dict:
        """Generate professional report"""
        
        # Calculate score
        score = 10
        severity_weights = {"critical": 3, "high": 2, "medium": 1, "low": 0.5}
        for bug in self.bugs:
            score -= severity_weights.get(bug.get("severity", "medium"), 1)
        score = max(0, min(10, round(score, 1)))
        
        # Generate summary
        if not self.bugs:
            summary = f"{self.persona['name']} ({self.persona['role']}) completed testing. No significant issues found in the areas tested."
        else:
            critical = len([b for b in self.bugs if b.get("severity") == "critical"])
            high = len([b for b in self.bugs if b.get("severity") == "high"])
            
            if critical > 0:
                summary = f"{self.persona['name']} found {len(self.bugs)} issues including {critical} critical. Immediate attention required."
            elif high > 0:
                summary = f"{self.persona['name']} found {len(self.bugs)} issues including {high} high severity. Review recommended."
            else:
                summary = f"{self.persona['name']} found {len(self.bugs)} minor issues. Site is functional but has room for improvement."
        
        # Add assessment if available
        if self.page_data.get("assessment"):
            summary += f" Assessment: {self.page_data['assessment'][:200]}"
        
        return {
            "persona": self.persona["name"],
            "role": self.persona["role"],
            "status": "cancelled" if self.cancelled else "completed",
            "bugs_found": self.bugs,
            "quality_score": score,
            "summary": summary,
            "test_duration": round(duration, 1),
            "phases_completed": self.phases_completed,
            "was_cancelled": self.cancelled
        }
