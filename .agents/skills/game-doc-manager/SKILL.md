---
name: game-doc-manager
description: >
  Manages all documentation for game development projects — including GDD (Game Design
  Documents), Software Design docs, and Agile management artifacts. Use this skill
  whenever the user mentions GDD, game design, sprint planning, backlog, software
  architecture for a game, class diagrams, or wants to create/update/review any
  project document. Trigger even for casual requests like "write up the game concept",
  "plan this sprint", "draft the system design", or "check if our docs are consistent".
  Outputs Markdown (.md) format. Designed for small teams (2–5 people) using an
  engine-agnostic approach.
---

# Game Development Document Manager

Acts as a disciplined technical writer and project manager for game development teams.
Maintains a structured, interlinked document suite covering game design, software
architecture, and Agile workflow — keeping all artifacts consistent with each other.

---

## Document Suite Overview

Three document groups, ordered by priority:

| Group | Purpose | Key Docs |
|-------|---------|----------|
| **GDD** | What the game IS | Concept & Architecture, Mechanics, Narrative |
| **Software Design** | How it's BUILT | System Design, Class Diagrams, Data Schema |
| **Agile Management** | How it's MANAGED | Product Backlog, Sprint Plans, Reports |

All documents live under `docs/` and cross-reference each other via relative links.

---

## Folder Structure

```
docs/
├── gdd/
│   ├── 00-concept.md           ← High-level game concept, vision & architecture
│   ├── 01-mechanics.md         ← Core gameplay loops & rules
│   ├── 02-narrative.md         ← Story, characters, world
│   ├── 03-art-direction.md     ← Visual style, UI/UX guidelines
│   └── 04-audio-direction.md   ← Music, SFX guidelines
├── software/
│   ├── 01-system-design.md     ← Subsystem breakdown
│   ├── 02-class-diagram.md     ← Key classes & relationships (Mermaid)
│   └── 03-data-schema.md       ← Data structures & persistence
├── agile/
│   ├── 01-product-backlog.md   ← Full feature & task list
│   ├── 02-sprint-planning.md   ← Overall roadmap & Gantt chart
│   ├── 03-meeting-backlogs.md  ← Meeting logs hub
│   ├── 04-retrospectives-backlog.md ← Retrospectives hub
│   ├── 05-report-backlog.md    ← System test reports hub
│   ├── kanban.md               ← Kanban board
│   ├── sprint-backlogs/        ← Per-sprint plan
│   ├── retrospectives/         ← Per-sprint retrospectives
│   ├── reports/                ← Detailed test reports (qa/, polish/, bugs/)
│   └── meeting-backlogs/       ← Detailed meeting logs
│   └── user-stories/           ← Detailed user stories
├── wiki/                       ← Ad-hoc knowledge, research, & guides
│   ├── agentic-ai/             ← AI skill guides
│   ├── camt-fun/               ← Research & experiments
│   ├── development/            ← Dev setup & guides
│   ├── guidelines/             ← Process rules
│   └── wiki.md                 ← Knowledge Hub
├── index.md                    ← Project status & doc inventory
└── changelog.md                ← Record of all doc updates
```

---

## Workflow

### Command: "create [doc type]"
Generate a new document from the appropriate template below.
Steps:
1. Identify which template to use (GDD / Software / Agile).
2. Fill placeholders from context provided by the user.
3. Add cross-references to related existing docs.
4. Update `docs/index.md` and `docs/changelog.md`.
5. Output as **Markdown** by default; offer `.docx` if user needs to share externally.

### Command: "update [doc]"
Edit an existing document.
Steps:
1. Read the current doc to understand existing content.
2. Apply changes without breaking cross-references.
3. If the change affects another doc (e.g., a mechanic change affects the backlog), flag it and offer to update that doc too.
4. Append an entry to `docs/changelog.md`.

### Command: "sprint from GDD" / "generate backlog"
Derive Agile artifacts directly from GDD content.
Steps:
1. Read `docs/gdd/01-mechanics.md` and other GDD files.
2. Identify features, systems, and tasks implied by the design.
3. Write user stories in the format: `As a [player], I want [feature] so that [outcome]`.
4. Populate `docs/agile/01-product-backlog.md` grouped by priority (Must Have / Should Have / Nice to Have).
5. If sprint length is given, generate a `docs/agile/sprint-backlogs/sprint-XX.md` with a realistic subset.

### Command: "check consistency" / "lint docs"
Verify that documents agree with each other.
Check for:
- Features described in GDD but missing from the backlog.
- Classes in Software Design not traceable to any GDD mechanic.
- Sprint tasks that reference docs/features not yet written.
- Broken links or missing cross-references.
Report findings as a checklist; offer to fix each one.

### Command: "create wiki" / "update wiki"
Manage the central knowledge hub.
Steps:
1. Scan `docs/gdd/`, `docs/software/`, `docs/agile/`, and `docs/wiki/` for content.
2. Update `docs/wiki/wiki.md` with organized links to all key artifacts.
3. Group ad-hoc knowledge in `docs/wiki/` into logical categories (e.g., "Research", "Dev Logs", "AI Experiments").
4. Ensure `docs/wiki/wiki.md` serves as the "Wiki Home" for the project.
5. Update `docs/index.md` to link to `docs/wiki/wiki.md` in the header and under the "Resources & Guidelines" section.

### Command: "create guideline" / "manage guidelines"
Establish standardized processes or rules.
Steps:
1. Create new guidelines in `docs/wiki/guidelines/`.
2. Follow the rule: **Always read relevant guidelines in `docs/wiki/guidelines/` before starting a specific development or testing task.**
3. Reference guidelines in relevant documents (e.g., mention the test guideline in the test report).
4. Update `docs/wiki/wiki.md` and `docs/index.md` to include the new guideline link.

---

## Templates

### GDD — Game Concept & Architecture (`docs/gdd/00-concept.md`)
```markdown
# [Game Title] — Game Concept & Architecture

**Version:** 1.0 | **Last Updated:** YYYY-MM-DD | **Owner:** [Name]

## 1. Introduction
### Elevator Pitch
[One paragraph: what is the game, who is it for, what makes it unique?]

### Target Audience
[age, gamer type, etc.]

---

## 2. Technical Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| Engine | [e.g., Phaser 3] | |
| Framework | [e.g., React] | |

---

## 3. Game Collection / Features
[Summary of what's in the game]

---

## 4. System Architecture
[High-level architecture description and Mermaid diagrams]

---

## Related Documents
- Mechanics: [Core Mechanics](../gdd/01-mechanics.md)
- Backlog: [Product Backlog](../agile/01-product-backlog.md)
```

### GDD — Core Mechanics (`docs/gdd/01-mechanics.md`)
```markdown
# [Game Title] — Core Mechanics

**Version:** 1.0 | **Last Updated:** YYYY-MM-DD

## Core Loop
[Describe the primary gameplay loop in 3–5 steps.]

## Player Actions
| Action | Input | Result | Notes |
|--------|-------|--------|-------|
| [Move] | [WASD] | [Character moves] | |

## Game Systems
### [System Name]
[Description of how this system works.]

**Linked to Software Design:** [System Design](../software/01-system-design.md)

## Win / Lose Conditions
- **Win:** [Condition]
- **Lose:** [Condition]
```

### Agile — Product Backlog (`docs/agile/01-product-backlog.md`)
```markdown
# [Game Title] — Product Backlog

**Last Updated:** YYYY-MM-DD | **Version:** 1.0

## Must Have (MVP)
| ID | User Story | Acceptance Criteria | Estimate | Status |
|----|-----------|---------------------|----------|--------|
| [US-XX-XX](./user-stories/US-XX-XX.md) | As a player, I want to [action] so that [outcome] | [Criteria] | [S/M/L] | [ ] |

## Linked GDD Features
- Derived from: [Core Mechanics](../gdd/01-mechanics.md), [Concept](../gdd/00-concept.md)
```

### Agile — Sprint Planning (`docs/agile/02-sprint-planning.md`)
```markdown
# Sprint Planning & Roadmap

**Last Updated:** YYYY-MM-DD | **Version:** 1.0

## 📅 Sprint Schedule Overview
| Sprint | Timeline | Focus Area | Status |
|:---|:---|:---|:---|
| [sprint-01](./sprint-backlogs/sprint-01.md) | YYYY-MM-DD | [Focus] | Completed |

## 🚀 Sprint Details
- **[sprint-01](./sprint-backlogs/sprint-01.md)**: [Focus Area]
```

### Agile — Sprint Plan (`docs/agile/sprint-backlogs/sprint-XX.md`)
```markdown
# Sprint [XX]: [Title]

**Goal:** [Goal]
**Timeline:** YYYY-MM-DD → YYYY-MM-DD

## 📅 Internal Timeline
```mermaid
gantt
    title Sprint [XX] Tasks
    dateFormat  YYYY-MM-DD
    section Development
    Task 1 :a1, YYYY-MM-DD, 3d
```

## 📋 Committed Stories & Tasks
| ID | Story / Task | Owner | Estimate | Status |
|----|--------------|-------|----------|--------|
| [US-XX-XX](../user-stories/US-XX-XX.md) | [Story title] | [Name] | [hrs] | [ ] |

## 🛠 Sprint Specifics
- **Definition of Done:** [...]
- **Risks & Blockers:** [...]
```

### Agile — User Story (`docs/agile/user-stories/US-XX-XX.md`)
```markdown
# User Story: US-[Epic]-[Number] - [Title]

**Status:** [✅ Done / 🔵 In Progress / 🏗 In-Progress]
**Epic:** [Epic Title](../01-product-backlog.md)
**Owner:** [Name]

---

## 📖 Description
**ในฐานะ** [Role]
**ฉันต้องการ** [Feature/Action]
**เพื่อให้** [Benefit]

---

## ✅ Acceptance Criteria
1. [ ] [Criteria 1]
2. [ ] [Criteria 2]

---

## 🛠 Technical Tasks (Git Log Updates)
- [ ] [Task 1]
- [ ] [Task 2]

---

## 🔗 Related Files
- Backlog: [Product Backlog](../01-product-backlog.md)
- GDD: [Mechanics](../../gdd/01-mechanics.md)
```

### Knowledge Hub — Wiki Home (`docs/wiki/wiki.md`)
```markdown
# 🌐 [Game Title] — Knowledge Wiki

**Last Updated:** YYYY-MM-DD | **Maintained by:** [Name/Role]

## 🎯 Quick Access
- **[Concept & Architecture]**: [Concept](../gdd/00-concept.md)
- **[Core Mechanics]**: [Mechanics](../gdd/01-mechanics.md)
- **[Current Sprint]**: [Sprint Planning](../agile/02-sprint-planning.md)
```
---

## 🧠 Knowledge Base (Wiki)
*Ad-hoc research, experiment logs, and specialized guides.*

### 📊 Reports & Research
- [System Test Reports](../agile/05-report-backlog.md)
- [Sprint Retrospectives](../agile/04-retrospectives-backlog.md)

---
*Powered by Antigravity Knowledge Management System.*
```

### Project Index (`docs/index.md`)
```markdown
# 🎮 [Game Title] — Project Index

**Project:** [Title]
**Status:** [Active/Draft] | **Current Sprint:** [Sprint N]
**Last Updated:** YYYY-MM-DD | **Knowledge Hub:** [Project Wiki](./wiki/wiki.md)

---

## 📘 Game Design (GDD)
[Links to GDD files]

---

## 💻 Software Design
[Links to Software files]

---

## 🚀 Agile Management
[Links to Agile files]

---

## 📚 Resources & Guidelines
- [Project Wiki](./wiki/wiki.md) - Central knowledge hub and logs
- [Testing Guidelines](./wiki/guidelines/system-test-guideline.md)
- [Documentation Changelog](./changelog.md)

---
*Generated by Antigravity AI Assistant.*
```

---

## Output Format Rules

- **Format:** Markdown (`.md`) — suitable for Git repos, Obsidian, GitHub Wiki, and VS Code.
- Always include `**Version:**` and `**Last Updated:**` fields in every document header.
- Use relative links (`[Label](./path/to/file.md)`) for internal cross-references to ensure compatibility with VS Code and standard Markdown viewers.

---

## Special Commands Reference

| User says | Action |
|-----------|--------|
| `"create GDD"` | Generate full GDD suite (concept + mechanics stubs) |
| `"create sprint [N]"` | Generate sprint plan from backlog |
| `"sprint from GDD"` | Auto-derive backlog + sprint from GDD content |
| `"update [doc name]"` | Edit existing doc, propagate changes |
| `"check consistency"` | Cross-check all docs for conflicts/gaps |
| `"retro sprint [N]"` | Generate retrospective template |
| `"status"` | Show `docs/index.md` — what exists, what's missing |

