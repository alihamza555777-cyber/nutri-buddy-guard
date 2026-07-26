# 🥗 NutriGuard — AI-Powered Food & Allergen Inspection System

> **Live Production Deployment URL:** [https://nutri-guard-buddy.vercel.app](https://nutri-guard-buddy.vercel.app)

---

## 📌 Problem Statement & Target Audience

### **The Real Problem:**
Millions of individuals live with life-threatening food allergies (such as peanut anaphylaxis, severe celiac disease/gluten intolerance, lactose intolerance, and shellfish allergies) or follow strict medical and religious dietary requirements (such as Halal, Vegan, or Keto diets).

When dining out at restaurants or scanning printed menu pages, people face critical challenges:
- **Ambiguous Menu Descriptions:** Menus rarely list secondary ingredients, cross-contamination risks, or hidden binders (e.g., flour in sauces, butter in pan-searing, peanut oil in frying).
- **Communication Barriers:** Restaurant waiters and kitchen staff are often busy or unaware of complex cross-contamination pathways.
- **Accidental Ingestion Risks:** A single mistake can lead to medical emergencies or hospitalization.

### **The Solution — NutriGuard:**
NutriGuard is an end-to-end, intelligent dietary vision assistant and allergen inspection system. By analyzing food dish photos, text queries, or entire multi-dish restaurant menu pages in real-time, NutriGuard cross-references visible ingredients and traditional culinary preparations against the user's specific allergy profile, flags hidden risks, generates custom scripts for restaurant servers, and tracks daily macronutrient intake with automatic midnight resets.

---

## 🌐 Live Deployed Application
- **Production Web App:** [https://nutri-guard-buddy.vercel.app](https://nutri-guard-buddy.vercel.app)

---

## ✨ Features & Capabilities

- 📷 **Instant Camera & Photo Inspection:** Upload a food photo or capture a live photo with your camera. NutriGuard downscales base64 images to 800px max width/height to optimize vision token consumption, inspects ingredients, and determines safety status (`SAFE`, `CAUTION`, `AVOID`).
- 🔍 **Text Dish Analysis:** Type any dish name (e.g. *"Chicken Pad Thai"*, *"Beef Stroganoff"*) to get an immediate allergen breakdown, flagged ingredients, and nutrition estimations.
- 📡 **Instant Menu Allergen Radar (`/menu-radar`):** Upload or capture a full restaurant menu page at once. NutriGuard's batch vision model extracts every dish on the page simultaneously, categorizes each dish by safety level, and provides instant search and status filtering (`Show All`, `Safe Only`, `Flagged Only`).
- 🗣️ **Dining Out Mode & Digital Waiter Card Modal:** Generates an exact, polite custom script for your server or kitchen staff highlighting your specific allergies and what questions to ask before ordering.
- 🛠️ **"Make It Safe" Order Recommendations:** Generates custom ingredient modifications and safe substitutions to convert flagged dishes into allergen-safe meals.
- 📊 **Daily Nutrition & Allergen Budget Dashboard:** Aggregates daily calorie, protein, carb, fat, fiber, sugar, and sodium totals with visual progress meters against personalized target goals.
- ⏰ **Automatic 12:00 AM Midnight Daily Reset (`useDailyReset`):** Automatically refreshes the daily nutrition intake counters and budget view at midnight local device time while permanently preserving historical records in the database.
- 📜 **Scan History Management (`/history`):** Complete log of past food scans with optimistic UI state updates, single-item deletion, and a bulk *"Clear All History"* confirmation dialog.
- 👤 **Health Profile & Dietary Settings (`/profile`):** Manage customizable allergy tags (Peanut, Tree Nut, Gluten, Lactose, Shellfish, Soy, Egg, Halal, Vegan, Keto), medical notes, BMI body metrics, and target calorie/protein goals.
- 🔐 **Supabase Authentication (`/auth`):** Secure login & signup with automatic duplicate email detection that gracefully switches users to the Sign In tab.

---

## 🤖 The AI Feature & System Prompts

NutriGuard is powered by an AI Vision and Natural Language processing engine using **Groq AI** (with **Gemini AI** fallback support).

### **AI Models Used:**
- **Vision Model (Photos & Menu Radar):** `qwen/qwen3.6-27b`
- **Text Analysis Model:** `llama-3.3-70b-versatile`

### **System Instructions & System Prompt:**
NutriGuard uses specialized clinical nutritionist system instructions to analyze food items strictly relative to the user's provided restriction set:

```markdown
You are NutriGuard's specialized clinical nutritionist and dietary vision AI.
Inspect the food image provided in this request carefully.

User Dietary Restrictions & Allergies: [{USER_RESTRICTIONS}]
Custom Medical Notes & Conditions: [{USER_NOTES}]

### Instructions:
1. Identify the primary dish and key visible ingredients in the picture.
2. Cross-reference the dish's typical preparation and ingredients against the user's explicit restrictions and notes.
3. Determine safety status strictly relative to user inputs:
   - "SAFE": Dish presents no clear match or high cross-contamination risk with user allergies.
   - "CAUTION": Dish contains or likely contacts a user restriction, or has common cross-contamination risks.
   - "AVOID": Dish directly contains a flagged restriction/allergen.
4. ONLY populate 'flagged_ingredients' if a detected ingredient explicitly violates one of the user's provided restrictions/notes. If the user provided NO restrictions, 'flagged_ingredients' MUST BE AN EMPTY ARRAY [].
5. Provide standard non-zero nutritional estimations for the portion shown in the picture.

You MUST respond strictly in valid, raw JSON (no markdown backticks, no markdown formatting, no conversational text before or after).
```

---

## 🛠️ Tools, Frameworks, & Services Used

- **Frontend Core:** React 18, TypeScript, TanStack Start (SSR & Server Functions), TanStack Router, TanStack Query
- **Styling & UI Components:** Tailwind CSS, Lucide React Icons, Radix UI Primitives (`@radix-ui/react-alert-dialog`, `@radix-ui/react-dialog`), Sonner Toast Notifications
- **Backend & Database:** Supabase (PostgreSQL Database, Auth, Storage Bucket for scan images, RLS Policies)
- **AI Infrastructure:** Groq API (`qwen/qwen3.6-27b` for vision, `llama-3.3-70b-versatile` for text analysis) & Google Gemini API (`gemini-1.5-flash`)
- **Build & Deployment:** Vite, Nitro Engine, Vercel (Cloudflare Module / Serverless Deployment)

---

## 📸 Screenshots of NutriGuard in Action

Below are visual demonstrations of the NutriGuard application across key user workflows:

### **1. Main Scanner & Food Allergen Inspection**
<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/16931bdd-652b-4b6b-9566-fc953697f5a1" />

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/5deebc93-3eab-4716-9742-6d7fdfaa2dc6" />

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/ad387ab0-6a73-40eb-8ab9-de96f3a6dcef" />

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/1de8ad6b-6732-4c77-9367-2afc424f481e" />

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/c55d8fab-aace-423e-8b07-584718e2eda6" />

### **2. Instant Menu Allergen Radar (`/menu-radar`)**

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/b88c3879-d12b-4781-bb44-9f4c04defbad" />

<img width="1223" height="693" alt="image" src="https://github.com/user-attachments/assets/c3a2df7d-0799-4ad2-a61f-19d61fafddd4" />


### **3. Dining Out Mode & Digital Waiter Card Modal**

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/c70c1df0-5395-458f-9306-0d7fd7abf367" />

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/9efdbb1c-0213-42ba-912e-6b1fea1a0ae2" />

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/66554b00-8f7f-4bca-8d7b-da9887aae6e8" />


### **4. Daily Nutrition Budget & Allergen Dashboard**

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/1b10ffca-1b4c-4309-af04-02891e36e54f" />


### **5. Scan History & Profile Management (`/history` & `/profile`)**

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/f1206e33-671f-4662-a572-0b252344cccc" />

<img width="1224" height="691" alt="image" src="https://github.com/user-attachments/assets/703c2e69-aef7-4052-b04c-05688a778248" />


---

## 🚀 How to Run the Project Locally

### **Prerequisites:**
- Node.js (v18.0.0 or higher)
- npm or pnpm

### **1. Clone the Repository:**
```bash
git clone https://github.com/alihamza555777-cyber/nutri-buddy-guard.git
cd nutri-buddy-guard
```

### **2. Install Dependencies:**
```bash
npm install
```

### **3. Set Up Environment Variables:**
Create a `.env` file in the root directory:
```env
VITE_GROQ_API_KEY=your_groq_api_key_here
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### **4. Start Local Development Server:**
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### **5. Build for Production:**
```bash
npm run build
```

---

## 📜 License & Author

- **Project:** NutriGuard (Nutri-Guard-Buddy)
- **Author:** Ali Hamza
- **Repository:** [https://github.com/alihamza555777-cyber/nutri-buddy-guard](https://github.com/alihamza555777-cyber/nutri-buddy-guard)
- **Live URL:** [https://nutri-guard-buddy.vercel.app](https://nutri-guard-buddy.vercel.app)
