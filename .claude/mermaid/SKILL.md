---
name: mermaid
description: Use when creating flowcharts, sequence diagrams, state machines, class diagrams, ER diagrams, or other Mermaid-style technical diagrams with a professional enterprise-grade aesthetic and Autonomize color scheme.
---

name: mermaid

# Mermaid-Style Technical Diagrams with Professional Enterprise-Grade Aesthetic

**Professional enterprise-grade technical diagrams combining Mermaid structure with polished precise aesthetic and Autonomize color scheme.**

Creates **PROFESSIONAL-GRADE MERMAID DIAGRAMS** — flowcharts, sequence diagrams, state machines, and other technical diagrams with clean polished precise vector feel, derived from content via story explanation.

---

name: mermaid

## Purpose

The Mermaid workflow creates structured technical diagrams (like Mermaid.js generates) but with a **professional enterprise-grade aesthetic** while maintaining **Autonomize editorial color scheme**. Unlike generic technical diagrams, these follow specific diagram grammar (flowcharts, sequences, states, etc.) and are derived from content analysis, not manually specified.

**Use this workflow for:**

- Flowcharts showing decision logic and process flows
- Sequence diagrams showing interactions over time
- State diagrams showing state transitions
- Class diagrams showing object relationships
- ER diagrams showing data models
- Git graphs showing branching/merging
- Any diagram where Mermaid structure + professional precise aesthetic is ideal

**This is NOT for:**

- Freeform architecture diagrams (use technical-diagrams.md)
- Abstract conceptual metaphors (use workflow.md editorial illustrations)
- Data visualizations (use visualize.md)

---

name: mermaid

## Mermaid Diagram Types Supported

### 1. Flowcharts

**When:** Decision trees, algorithmic logic, process flows with conditions

```
Start -> Decision? -> [Yes] -> Action -> End
                   -> [No] -> Different Action -> End
```

### 2. Sequence Diagrams

**When:** Interactions between entities/actors over time

```
User -> API: Request
API -> Database: Query
Database -> API: Results
API -> User: Response
```

### 3. State Diagrams

**When:** State machines, status transitions, lifecycle flows

```
[Idle] -> (trigger) -> [Processing] -> (complete) -> [Done]
                                    -> (error) -> [Failed]
```

### 4. Class Diagrams

**When:** Object relationships, inheritance, composition

```
User --has many--> Posts
User --belongs to--> Organization
Post --has many--> Comments
```

### 5. Entity Relationship Diagrams

**When:** Database schemas, data models, table relationships

```
Customer ||--o{ Order : places
Order ||--o{ LineItem : contains
Product ||--o{ LineItem : ordered_in
```

### 6. Gantt Charts

**When:** Project timelines, task dependencies, schedules

```
Task 1: Jan 1 - Jan 15
Task 2: Jan 10 - Jan 30 (depends on Task 1)
Task 3: Jan 20 - Feb 10
```

### 7. Git Graphs

**When:** Branching strategies, merge flows, version control

```
main --> feature branch --> merged back --> main
     \--> hotfix ----------> merged ------> main
```

---

name: mermaid

## Professional Enterprise-Grade Aesthetic Principles

**Think:** Polished technical drafting, clean enterprise Visio-quality diagram

### Visual Characteristics

1. **Clean precise boxes** — Rectangles with sharp, precise geometric edges
2. **Straight arrows** — Arrows that are clean and straight, ruler-precise
3. **Sharp edges** — Everything has clean geometric precision
4. **Clean professional typography** — Labels are professionally typeset, not handwritten
5. **Professional feel** — Looks like a professional technical diagram
6. **Consistent line weight** — Heavier for boxes, lighter for arrows
7. **Crossing-out style** — Double-line or bold crossing for connections

### What This Looks Like

- Diamond decision boxes with precise clean edges
- Arrows that are straight and well-aligned
- Clean precise rectangles with consistent geometry
- Text that's precisely aligned
- Clean precise circles with consistent geometry
- Lines that connect cleanly at nodes with polished joins

### AVOID

- Messy or sketchy lines
- Hand-drawn or whiteboard look
- Wobbly or organic imperfections
- Inconsistent alignment
- Rough or unpolished edges
- Informal or casual appearance

---

name: mermaid

## Color System for Mermaid Diagrams

### Structure

```
Black #000000 — All primary linework (boxes, arrows, decision diamonds)
```

### Flow Emphasis

```
Vibrant Purple #731ee3 — Critical path, main flow, important states
Warm Gold #e8af57 — Alternative paths, secondary flows, supporting states
Charcoal #2D2D2D — All text labels and annotations
```

### Background

```
Dark Navy #1f0448 — Clean professional background
OR
White #FFFFFF — Clean background
```

### Color Strategy for Diagram Types

**Flowcharts:**

- Main path boxes: Cyan outlines
- Alternative branches: Gold outlines
- Decision diamonds: Black outlines
- All connecting arrows: Black

**Sequence Diagrams:**

- Critical actor/entity: Cyan box
- Secondary actors: Gold boxes
- All messages/arrows: Black
- Activation boxes: Cyan fills (subtle)

**State Diagrams:**

- Active/important states: Cyan
- Transition states: Gold
- Terminal states: Black
- Arrows: Black with labels

**Class/ER Diagrams:**

- Key entities: Cyan boxes
- Related entities: Gold boxes
- Relationships: Black arrows with labels
- Inheritance: Black with different arrow style

---

name: mermaid

## MANDATORY WORKFLOW STEPS

### Step 1: Run Story Explanation on Content (MANDATORY)

**CRITICAL: You MUST use /cse (Create Story Explanation) with 24-item length.**

This extracts the full narrative arc and identifies the STRUCTURE that needs to be diagrammed.

```bash
/cse [content or URL]
```

The 24-item output reveals:

- Process flows and sequences
- Decision points and conditions
- State transitions and triggers
- Entity relationships and interactions
- Temporal ordering and dependencies

**Do NOT skip this step. Do NOT manually derive diagram structure without running /cse first.**

**Output from CSE Analysis:**

```
24-ITEM STORY EXPLANATION:
1. [Item 1]
2. [Item 2]
...
24. [Item 24]

STRUCTURAL ELEMENTS IDENTIFIED:
- Processes: [List of distinct processes/actions]
- Decisions: [List of decision points with conditions]
- States: [List of distinct states]
- Entities: [List of actors/objects/components]
- Flows: [List of connections and sequences]
- Conditions: [List of triggers and transitions]
```

---

name: mermaid

### Step 2: Determine Optimal Mermaid Diagram Type

**Based on CSE analysis, identify the best diagram type:**

#### Decision Framework

**Choose FLOWCHART when:**

- Content describes process with decision points
- "If/then/else" logic is present
- Multiple paths based on conditions
- Algorithm or procedure being explained
- Clear start and end points

**Choose SEQUENCE DIAGRAM when:**

- Content describes interactions between entities over time
- Request/response patterns present
- Multiple actors communicating
- Temporal ordering is critical
- API calls, messaging, or protocols

**Choose STATE DIAGRAM when:**

- Content describes states and transitions
- Status changes are central
- Lifecycle or workflow states
- Event-driven transitions
- System can be in discrete states

**Choose CLASS/ER DIAGRAM when:**

- Content describes relationships between objects/entities
- Data structures or models
- Inheritance or composition patterns
- Database schemas
- Object hierarchies

**Choose GANTT CHART when:**

- Content describes project timeline
- Task dependencies and schedules
- Milestones and deadlines
- Parallel and sequential tasks

**Choose GIT GRAPH when:**

- Content describes version control workflow
- Branching strategies
- Merge patterns
- Release flows

**Multiple diagram types possible?**

- Choose the PRIMARY type that captures the main structure
- Can note that alternative representations exist
- Focus on the most illuminating visualization

**Output from Type Selection:**

```
DIAGRAM TYPE: [Flowchart / Sequence / State / Class / ER / Gantt / Git Graph]

RATIONALE: [Why this type best represents the content]

ALTERNATIVE TYPES CONSIDERED: [If any, and why not chosen]
```

---

name: mermaid

### Step 3: Extract Diagram Structure from CSE

**Map the 24-item story explanation to diagram components:**

#### For Flowcharts

Identify:

- **Start node:** Where does the process begin?
- **Process nodes:** What actions happen? (rectangles)
- **Decision nodes:** What choices are made? (diamonds)
- **End nodes:** Where does it terminate? (rounded rectangles)
- **Flows:** How do nodes connect? (arrows with labels)

#### For Sequence Diagrams

Identify:

- **Actors/Entities:** Who/what participates? (boxes at top)
- **Messages:** What communications occur? (arrows between lifelines)
- **Temporal order:** What sequence? (top to bottom)
- **Activations:** When are entities active? (vertical bars)

#### For State Diagrams

Identify:

- **States:** What are the distinct states? (rounded boxes)
- **Initial state:** Where does it start? (filled circle)
- **Final state:** Where does it end? (double circle)
- **Transitions:** What triggers state changes? (arrows with conditions)
- **Events:** What causes transitions?

#### For Class/ER Diagrams

Identify:

- **Entities/Classes:** What objects exist? (boxes)
- **Attributes:** What properties? (inside boxes)
- **Relationships:** How do they relate? (arrows with cardinality)
- **Inheritance:** What hierarchies? (special arrows)

**Output from Structure Extraction:**

```
DIAGRAM COMPONENTS:

[For Flowchart Example:]
NODES:
- Start: [Label]
- Process 1: [Action description] (rectangle, purple)
- Decision 1: [Question] (diamond, black)
- Process 2a: [Action if yes] (rectangle, purple)
- Process 2b: [Action if no] (rectangle, teal)
- End: [Terminal state] (rounded, black)

FLOWS:
- Start -> Process 1: (black arrow)
- Process 1 -> Decision 1: (black arrow)
- Decision 1 -> Process 2a: "Yes" (black arrow)
- Decision 1 -> Process 2b: "No" (black arrow)
- Process 2a -> End: (black arrow)
- Process 2b -> End: (black arrow)

CRITICAL PATH: [Start -> Process 1 -> Decision 1 -> Process 2a -> End]
(This path highlighted with purple boxes)
```

---

name: mermaid

### Step 4: Design Professional-Grade Layout

**Plan the professional enterprise-grade aesthetic:**

#### A. Spatial Arrangement

- **Flowcharts:** Top-to-bottom or left-to-right flow
- **Sequence diagrams:** Actors across top, interactions descending
- **State diagrams:** Circular or network layout
- **Class diagrams:** Hierarchical tree or interconnected network
- **ER diagrams:** Entities spread out with relationships between
- **Gantt:** Horizontal timeline with tasks stacked vertically
- **Git graph:** Branching tree structure

#### B. Professional Vector Styling

Each node type gets polished professional treatment:

**Rectangles (Process boxes):**

```
Instead of: +----------+
This:       +----------+  (clean, precise geometric)
           |  Process  |  (perfectly aligned)
           +----------+  (sharp clean edges)
```

**Diamonds (Decisions):**

```
Instead of: <>
This:       <>  (clean, symmetric, precise diamond)
```

**Arrows:**

```
Instead of: ----------->
This:       ----------->  (straight, clean, precise)
```

**Text:**

```
Instead of: Arial 12pt
This:       Clean professional typography, precise alignment
```

#### C. Visual Hierarchy

- **Primary path/flow:** Cyan boxes, thicker lines
- **Secondary paths:** Gold boxes, standard lines
- **Structure/framework:** Black lines and shapes
- **Labels/text:** Charcoal, clean professional style

**Output from Layout Design:**

```
SPATIAL LAYOUT: [Top-to-bottom flow / Left-to-right / Circular / etc.]

PROFESSIONAL STYLING NOTES:
- All boxes: Clean precise rectangles, perfectly aligned
- Arrows: Straight clean lines, precise routing
- Diamonds: Symmetric, precise geometric feel
- Circles: Clean precise circles, consistent geometry
- Text: Professional typography, precise alignment

NODE POSITIONING:
[Describe relative positions, e.g.:]
- Start node: Top center
- Process 1: Below start, precisely aligned
- Decision 1: Below process 1, centered
- Process 2a: Bottom left (Yes branch)
- Process 2b: Bottom right (No branch)
- End nodes: Bottom (two endpoints merge)

CONNECTION PATHS:
[Describe arrow routes with clean precise paths]
```

---

name: mermaid

### Step 5: Construct Comprehensive Prompt

**Build the generation prompt with professional enterprise-grade + Mermaid + Autonomize aesthetic:**

### Prompt Template

```
Professional enterprise-grade Mermaid [DIAGRAM TYPE] in polished technical drafting style.

STYLE REFERENCE: professional technical diagram, precise vector flowchart, enterprise-grade technical diagram

BACKGROUND: [Dark Navy #1f0448 / White #FFFFFF] — clean professional background

AESTHETIC:
- Professional enterprise-grade style (clean, precise, polished)
- Polished professional quality (looks professionally crafted, not informal)
- Sharp precise edges on all shapes (clean rectangles, precise circles)
- Straight precise arrows (clean lines, ruler-straight)
- Clean professional text labels (precise alignment, polished typography)
- Variable line weight (boxes thicker, arrows medium, details thinner)
- Clean connections (lines join precisely, polished overlaps at nodes)
- Professional geometric precision, clean polished vectors

DIAGRAM TYPE: [Flowchart / Sequence Diagram / State Diagram / etc.]

OVERALL STRUCTURE:
[Describe the complete diagram flow, e.g.:]
- [DIAGRAM TYPE] showing [what it represents]
- Layout: [Top-to-bottom / Left-to-right / etc.]
- [Number] main nodes/states/entities
- Critical path highlighted in purple
- Alternative paths in teal

TYPOGRAPHY SYSTEM (3-TIER):

TIER 1 - DIAGRAM TITLE (Advocate Block Display):
- "[DIAGRAM TITLE]"
- Font: Advocate style, clean professional typography, all-caps
- Size: Large but not dominating (10% of diagram height)
- Color: Black #000000
- Position: Top center or top left
- Example: "USER AUTHENTICATION FLOW"

TIER 2 - NODE LABELS (Concourse Sans Professional):
- Labels inside boxes/nodes
- Font: Concourse-style geometric sans, clean professional rendering
- Size: Medium readable
- Color: Charcoal #2D2D2D
- Style: Precise, cleanly aligned
- Examples: "Process Request", "Valid?", "Success State"

TIER 3 - EDGE LABELS (Advocate Condensed):
- Labels on arrows/connections
- Font: Advocate condensed, smaller
- Size: 60% of Tier 2
- Color: Charcoal #2D2D2D
- Style: Clean professional annotations along arrows
- Examples: "Yes", "No", "timeout", "success"

DIAGRAM COMPONENTS (Professional Enterprise-Grade Style):

[LIST EACH NODE/COMPONENT:]

NODE 1: [Type - e.g., START NODE]
- Shape: [Rounded rectangle / Circle / etc.]
- Label: "[Label text]"
- Style: Clean precise edges, perfectly symmetric
- Color: Black (#000000) outline, no fill OR subtle charcoal fill
- Size: [Relative size]
- Position: [Location in layout]

NODE 2: [Type - e.g., PROCESS BOX]
- Shape: Rectangle with sharp edges
- Label: "[Action description]"
- Style: Clean lines, precisely aligned, polished precision
- Color: Cyan (#731ee3) outline — CRITICAL PATH
- Fill: Light charcoal or transparent
- Size: [Relative size]
- Position: [Below Node 1]

NODE 3: [Type - e.g., DECISION DIAMOND]
- Shape: Diamond/rhombus with clean edges
- Label: "[Question?]"
- Style: Precise, symmetric diamond, clean edges
- Color: Black (#000000) outline
- Fill: Transparent or very dark navy
- Size: [Relative size]
- Position: [Below Node 2, centered]

NODE 4: [Type - e.g., PROCESS BOX - ALTERNATIVE PATH]
- Shape: Rectangle with sharp edges
- Label: "[Alternative action]"
- Style: Clean lines, precisely aligned
- Color: Gold (#e8af57) outline — SECONDARY PATH
- Fill: Light charcoal or transparent
- Size: [Relative size]
- Position: [To the side, alternative branch]

NODE 5: [Type - e.g., END NODE]
- Shape: Rounded rectangle or double circle
- Label: "[Terminal state]"
- Style: Precise, clean curves
- Color: Black (#000000) outline
- Fill: Subtle fill or transparent
- Size: [Relative size]
- Position: [Bottom of diagram]

[Continue for all nodes...]

CONNECTIONS (Precise Straight Arrows):

ARROW 1: [Node A] -> [Node B]
- Style: Clean precise arrow, straight and well-aligned
- Path: [Describe route, e.g., "routes cleanly from Node 1 down to Node 2"]
- Color: Black (#000000)
- Label: [Optional label text, e.g., "process" or condition]
- Arrowhead: Clean precise triangle, perfectly symmetric

ARROW 2: [Node C] -> [Node D]
- Style: Clean precise arrow, straight and polished
- Path: [Describe route]
- Color: Black (#000000)
- Label: "[Yes]" in small clean professional style
- Arrowhead: Clean precise triangle

[Continue for all arrows/connections...]

SPECIAL ELEMENTS (if applicable):

[For Sequence Diagrams:]
- Actor boxes: Clean precise rectangles at top
- Lifelines: Dashed vertical lines (clean, precise)
- Activation boxes: Rectangles on lifelines (purple for key)
- Messages: Arrows between lifelines with labels

[For State Diagrams:]
- Initial state: Filled circle (clean precise)
- Final state: Double circle (clean concentric circles)
- State boxes: Rounded rectangles with sharp edges
- Transition arrows: Curved arrows with condition labels

[For Class/ER Diagrams:]
- Class boxes: Three-section rectangles (clean dividers)
- Relationship lines: Different arrow styles for different relationships
- Cardinality labels: Clean professional "1", "*", "0..1", etc.

COLOR USAGE (Strategic, Autonomize Palette):
- Black (#000000): All primary structure (most boxes, all arrows)
- Vibrant Purple (#731ee3): Critical path nodes, main flow, key entities (10-20% of nodes)
- Warm Gold (#e8af57): Alternative paths, secondary entities (5-10% of nodes)
- Charcoal (#2D2D2D): All text labels (node labels, arrow labels)
- Background: Dark Navy (#1f0448) OR White (#FFFFFF)

CRITICAL REQUIREMENTS:
- Professional enterprise-grade aesthetic (clean, precise, polished)
- Mermaid diagram structure ([chosen type] grammar)
- Autonomize color scheme (purple for critical, teal for secondary, black structure)
- 3-tier typography (title, node labels, edge labels)
- Polished professional feel (clean, enterprise-quality)
- All shapes precise (rectangles clean, circles precise, arrows straight)
- Variable line weight (thicker boxes, medium arrows, thin details)
- Clean professional text (precise alignment, polished typography)
- Strategic color (not everything colored, mostly black structure)
- Readable and clear with professional polish
- Follows [Mermaid diagram type] conventions

VALIDATION CHECKPOINTS:
- Does it look like a professional technical diagram (not informal or sketchy)?
- Are all geometric shapes precise and clean?
- Is the diagram type structure clear (flowchart/sequence/state/etc.)?
- Can you follow the flow/logic/sequence easily?
- Is the critical path obvious (purple highlights)?
- Are labels readable with clean professional typography?
- Does it maintain Autonomize aesthetic (flat colors, no gradients)?

Sign "Autonomize.ai" in small Sora font, subdued gray (#a0a0a0), bottom right corner with slight margin.
```

---

name: mermaid

### Step 6: Determine Aspect Ratio

**Based on diagram type and complexity:**

| Diagram Type           | Typical Aspect Ratio | Reasoning                |
| ---------------------- | -------------------- | ------------------------ |
| Flowchart (vertical)   | 9:16 or 4:3          | Top-to-bottom flow       |
| Flowchart (horizontal) | 16:9 or 21:9         | Left-to-right flow       |
| Sequence diagram       | 16:9                 | Actors across, time down |
| State diagram          | 1:1                  | Circular/network layout  |
| Class diagram          | 1:1 or 4:3           | Tree or network          |
| ER diagram             | 16:9 or 1:1          | Entity spread            |
| Gantt chart            | 16:9 or 21:9         | Timeline horizontal      |
| Git graph              | 16:9                 | Branching horizontal     |

**Default: 16:9** — Works for most diagram types

---

name: mermaid

### Step 7: Generate with Nano Banana Pro

**Execute with optimal model for text-heavy diagrams:**

```bash
bun run ${CLAUDE_PLUGIN_ROOT}/shared/tools/generate-autonomize-image.ts \
  --model nano-banana-pro \
  --prompt "[YOUR COMPREHENSIVE PROMPT]" \
  --size 2K \
  --aspect-ratio [chosen ratio] \
  --output /path/to/mermaid-diagram.png
```

**Why Nano Banana Pro:**

- Best text rendering (critical for labels on nodes and arrows)
- Handles complex multi-element compositions
- Can render professional precise aesthetic while maintaining readability
- Excellent for technical diagrams with lots of labels

**Note:** Do NOT use `--remove-bg` for Mermaid diagrams — the background supports the professional clean aesthetic.

**Immediately open:**

```bash
open /path/to/mermaid-diagram.png
```

---

name: mermaid

### Step 8: Comprehensive Validation (MANDATORY)

**Validate across all dimensions:**

#### Diagram Correctness

- [ ] **Structure accurate:** Diagram follows [type] conventions
- [ ] **Logic clear:** Flow/sequence/states make sense
- [ ] **Complete:** All elements from CSE represented
- [ ] **Connections correct:** Arrows point to right places
- [ ] **Labels accurate:** Node and edge labels match content

#### Professional Enterprise-Grade Aesthetic

- [ ] **Professional feel:** Looks like a polished enterprise technical diagram
- [ ] **Clean precise shapes:** Precise geometric rectangles/circles
- [ ] **Straight arrows:** Clean precise lines, well-aligned
- [ ] **Clean typography:** Professional, precisely aligned text
- [ ] **Variable line weight:** Thicker boxes, thinner details
- [ ] **Polished joins:** Connections look clean and precise

#### Autonomize Editorial Style

- [ ] **Color strategic:** Cyan on critical (10-20%), teal on secondary (5-10%)
- [ ] **Black dominant:** Most structure in black
- [ ] **Typography hierarchy:** 3 tiers clear
- [ ] **No gradients:** Flat colors maintained
- [ ] **"Autonomize.ai" signature:** Sora font, subdued gray (#a0a0a0), bottom right

#### Readability & Clarity

- [ ] **Labels readable:** All text legible with clean professional style
- [ ] **Flow obvious:** Can follow the diagram easily
- [ ] **Critical path clear:** Cyan highlights guide eye
- [ ] **Not cluttered:** Spacing adequate, not cramped
- [ ] **Scale works:** Readable at thumbnail and full-size

#### If Validation Fails

**Common issues and fixes:**

| Problem                       | Diagnosis                                | Fix                                                                                                   |
| ----------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Too informal/sketchy**      | Missing professional aesthetic           | Emphasize: "Clean precise rectangles, straight arrows, polished professional diagram, precise shapes" |
| **Inconsistent geometry**     | Shapes not clean enough                  | "All rectangles with precise edges, circles perfectly round, clean geometric precision throughout"    |
| **Can't follow flow**         | Unclear structure                        | Strengthen arrow directions, add labels, clarify critical path with purple                            |
| **Labels unreadable**         | Text too small or unclear                | Increase label size, use clean professional typography: "Readable professional style"                 |
| **Wrong diagram type**        | Doesn't match content                    | Return to Step 2, reconsider diagram type based on CSE                                                |
| **Missing Mermaid structure** | Doesn't follow conventions               | Add proper diagram grammar: decision diamonds for flowcharts, lifelines for sequence, etc.            |
| **Color overload**            | Too much purple/teal                     | Limit: "Cyan on 2-3 critical nodes only, teal on 1-2 secondary, rest black"                           |
| **Looks generic**             | Missing Autonomize or professional style | Combine both: "Professional polished technical drafting + Autonomize purple/teal strategic accents"   |

**Regeneration Process:**

1. Identify specific validation failures
2. Update prompt with targeted fixes from table
3. Regenerate with refined prompt
4. Re-validate against all checkpoints
5. Repeat until ALL validation criteria pass

**CRITICAL: Do not declare completion until validation passes.**

---

name: mermaid

## Diagram Type Deep Dives

### Flowchart Specifics

**Node Types:**

- **Start/End:** Rounded rectangles (clean precise ovals)
- **Process:** Rectangles with sharp edges
- **Decision:** Diamonds (symmetric, precise)
- **Input/Output:** Parallelograms (clean, precise)
- **Predefined Process:** Rectangles with double side lines

**Flow Rules:**

- Always flows one direction (typically top-down or left-right)
- Arrows never cross if avoidable
- Decision diamonds have exactly 2 exits (Yes/No or True/False)
- Loops back with curved arrows

**Color Strategy:**

- Cyan: Main success/happy path
- Gold: Error handling or alternative paths
- Black: All decision nodes and structure

---

name: mermaid

### Sequence Diagram Specifics

**Components:**

- **Actors/Entities:** Boxes at top (clean precise rectangles)
- **Lifelines:** Vertical dashed lines (clean, precise)
- **Messages:** Horizontal arrows between lifelines
- **Activations:** Vertical bars on lifelines (when entity is active)
- **Return messages:** Dashed arrows going back

**Temporal Flow:**

- Always top to bottom (time flows down)
- Left to right is actor/entity ordering
- Synchronous: Solid arrow
- Asynchronous: Open arrow
- Return: Dashed arrow

**Color Strategy:**

- Cyan: Critical actor/main entity
- Gold: Secondary actors
- Black: All messages/arrows
- Cyan fill: Activation bars for critical entity

---

name: mermaid

### State Diagram Specifics

**Components:**

- **States:** Rounded rectangles (clean precise)
- **Initial state:** Filled circle (clean precise circle)
- **Final state:** Double circle (concentric clean circles)
- **Transitions:** Arrows with event labels
- **Conditions:** Guards in brackets on arrows

**State Rules:**

- Each state is distinct and named
- Transitions show event/condition
- Initial state has only outgoing arrows
- Final state has only incoming arrows

**Color Strategy:**

- Cyan: Active/current/important states
- Gold: Intermediate states
- Black: Terminal and error states
- All transitions: Black arrows

---

name: mermaid

### Class/ER Diagram Specifics

**Components:**

- **Classes/Entities:** Three-section boxes (name, attributes, methods)
- **Relationships:** Arrows with labels
- **Cardinality:** 1, _, 0..1, 1.._ on relationship lines
- **Inheritance:** Triangle arrow pointing to parent
- **Composition:** Diamond on containing class

**Relationship Types:**

- Association: Plain arrow
- Inheritance: Arrow with triangle head
- Composition: Arrow with filled diamond
- Aggregation: Arrow with open diamond

**Color Strategy:**

- Cyan: Core/important entities
- Gold: Related entities
- Black: All relationship lines
- Charcoal: All attribute/method text

---

name: mermaid

## Example Scenarios

### Example 1: Flowchart for Authentication Flow

**Content:** Blog post about user authentication process
**CSE Result:** 24-item story showing login attempt -> credential check -> success/failure paths
**Diagram Type:** Flowchart
**Structure:** Start -> Enter Credentials -> Valid? -> [Yes] -> Generate Token -> Success
-> [No] -> Retry Limit? -> [Yes] -> Lock Account
-> [No] -> Return to Enter
**Color:** Cyan on success path, Gold on error handling
**Aspect:** 9:16 vertical

### Example 2: Sequence Diagram for API Call

**Content:** Technical article about microservices communication
**CSE Result:** 24-item story showing User -> API Gateway -> Auth Service -> Database -> Response chain
**Diagram Type:** Sequence Diagram
**Structure:** 4 actors (User, Gateway, Auth, DB) with message arrows showing request/response flow
**Color:** Cyan on Gateway (critical), Gold on Auth (secondary)
**Aspect:** 16:9 horizontal

### Example 3: State Diagram for Order Lifecycle

**Content:** E-commerce order processing explanation
**CSE Result:** 24-item story showing order states: Pending -> Processing -> Shipped -> Delivered (with error states)
**Diagram Type:** State Diagram
**Structure:** Initial -> Pending -> Processing -> Shipped -> Delivered -> Final
-> (error) -> Cancelled
**Color:** Cyan on happy path states, Gold on processing, Black on cancelled
**Aspect:** 1:1 square

### Example 4: ER Diagram for Database Schema

**Content:** Data modeling article about blog platform
**CSE Result:** 24-item story revealing entities: Users, Posts, Comments, Categories with relationships
**Diagram Type:** Entity Relationship Diagram
**Structure:** User 1--_ Post, Post 1--_ Comment, Post _--_ Category (many-to-many)
**Color:** Cyan on User and Post (core), Gold on Comment and Category
**Aspect:** 16:9 horizontal

---

name: mermaid

## Quick Reference

### When to Use Mermaid Workflow

- Content has inherent diagram structure (flow, sequence, states)
- Need structured technical diagram (not freeform architecture)
- Want professional enterprise-grade aesthetic
- Deriving diagram from content analysis (not manually specified)

### Mermaid vs Technical Diagrams

- **Mermaid:** Structured diagram types (flowchart, sequence, etc.), professional polished aesthetic
- **Technical:** Freeform architecture diagrams, cleaner precise vector style

### Process Summary

```
1. Run /cse (24-item story explanation) <- MANDATORY
2. Determine diagram type (flowchart, sequence, state, etc.)
3. Extract structure from CSE (nodes, edges, flows)
4. Design professional layout (clean, precise, polished)
5. Construct comprehensive prompt
6. Choose aspect ratio (based on diagram type)
7. Generate with nano-banana-pro
8. Validate thoroughly (structure + aesthetic + Autonomize + readability)
```

### Core Principles

1. **CSE-driven:** Always derive from content analysis, never manually specify
2. **Mermaid grammar:** Follow proper diagram type conventions
3. **Professional aesthetic:** Polished enterprise-grade technical drafting feel
4. **Autonomize color scheme:** Strategic purple/teal, black structure
5. **Readable precision:** Precise and clear

---

name: mermaid

**The workflow: /cse -> Diagram Type -> Structure -> Professional Design -> Prompt -> Generate -> Validate -> Complete**

**The synthesis: Mermaid structure + professional enterprise-grade aesthetic + Autonomize editorial style = Technical diagrams that look like polished professional enterprise diagrams.**

---

name: mermaid

## Fallback (No API Key)

If no Gemini/OpenAI API key is available, use the free local tool:

```bash
uv run ${CLAUDE_PLUGIN_ROOT}/shared/tools/mermaid-to-svg.py \
  --input "graph LR; A[Start]-->B[Process]-->C[End]" \
  --output /path/to/diagram.mmd \
  --render png \
  --theme autonomize
```

This generates:

- `.mmd` file (renders natively in GitHub)
- Optional SVG/PNG with Autonomize purple theme

No API keys required. Uses Playwright + mermaid.js for rendering.
