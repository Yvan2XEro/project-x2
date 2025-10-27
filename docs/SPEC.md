---
## **1. Project Objective**

Develop an intelligent research assistant designed for strategy consulting and investment professionals, capable of producing structured analyses from trusted data sources through a multi-agent process.
---

## **2. Main Functionalities**

### **2.1 User Interface**

- A chat-style interface where the user can freely type a business question (e.g., _“What is the FinTech market outlook in the United Kingdom for 2024?”_).
- Input field and query history tracking.
- Display of results as an **executive summary** followed by **detailed analytical sections** with data, visuals, and cited sources.

---

## **3. Functional Process (Agents)**

### **Agent 0: User Identification**

- Identify the user’s role and professional profile from their email domain or LinkedIn information.
- Adapt tone, depth, and output formatting based on the detected profile.

---

### **Agent 1: Topic Classification**

- Analyse the user’s query and classify it under:
  - A **sector** (e.g., Financial Services).
  - A **function** (e.g., Market Analysis).

- This classification determines which analytical frameworks and data sources will be used.

---

### **Agent 2: Prompt Enhancement**

- Extract the **key analytical components** from the query.
- Select an appropriate **analysis framework** from an internal repository (e.g., Porter’s Five Forces, SWOT, PESTEL, etc.).
- Define **SMART objectives** (Specific, Measurable, Attainable, Relevant, Time-bound).
- Generate an enhanced, structured version of the prompt for downstream agents.

---

### **Agent 3: Scope Management (Lead Manager)**

- Break down the enhanced prompt into a **checklist of analytical components**.
- Assign each sub-component to specialized mini-agents based on domain expertise.

---

### **Agent 4: Source Management**

- Maintain a **repository of preferred and trusted data sources**, categorized by sector and function.
- Automatically identify mentioned companies and retrieve their official websites.
- Allow the user to restrict searches to trusted or verified sources only.

---

### **Agent 5: Data Connection**

- Connect to **external data repositories** (free and paid).
- Dynamically fetch relevant datasets for the current query.

---

### **Agent 6: Semantic Search**

- Perform a **multi-channel search** across:
  - The web (search engines).
  - Proprietary and partner datasets.
  - Files uploaded by the user.

- Extract relevant data points, text, and tables aligned with the query structure.

---

### **Agent 7: Data Gap Identification**

- Detect **missing or incomplete information** in the retrieved data.
- Produce a **list of follow-up questions or data gaps**.
- These gaps may later be submitted to human experts (Phase 4).

---

### **Agent 8: Data Analysis**

- Conduct **quantitative and qualitative analyses** (e.g., trend extrapolation, comparisons, ratios).
- Apply relevant analytical models depending on the topic.
- Generate charts, tables, and insights accordingly.

---

### **Agent 9: Data Presentation**

- Structure the output into two key sections:
  1. **Executive Summary** – concise synthesis of main findings and key insights.
  2. **Analytical Sections** – detailed visuals, datasets, and interpretations.

- Ensure professional layout and logical flow of information.

---

### **Agent 10: Quality Control**

- Verify that:
  - All checklist items are addressed.
  - Only trusted sources are used and cited correctly.
  - Data gaps are explicitly listed.
  - The output complies with the required structure and presentation standards.

---

## **4. Project Phasing**

### **Phase 1: MVP – Research Assistant**

- Deploy the full chain of agents (0–10).
- Implement operational chat interface.
- Enable access to public data and user-uploaded files.

### **Phase 2: Enterprise Offering**

- Offer the data connection and semantic search modules as an enterprise framework.
- Integrate **on-demand billing** for access to paid datasets.

### **Phase 3: Collaboration and Security**

- Introduce **team spaces** and **personal assistants** for users.
- Enable connections to internal corporate data sources (e.g., SharePoint).
- Implement full-scale **security, compliance, and auditing** mechanisms.

### **Phase 4: Expert Community**

- Allow verified users to act as experts who can fill data gaps identified by others.
- Coordinate expert requests through automated micro-messaging or AI prompts.

---

## **5. Functional Constraints**

- The user must be able to:
  - Restrict data searches to trusted sources.
  - Upload their own files for analysis enrichment.
  - Export results as structured reports or tables.

- The system must:
  - Maintain query and output history.
  - Guarantee confidentiality and traceability of access.
  - Produce **auditable, well-sourced, and reproducible** results.

---
