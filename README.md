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
![Screenshot 1: Main Scanner & AI Food Analysis Output](./screenshots/screenshot1.png)

### **2. Instant Menu Allergen Radar (`/menu-radar`)**
![Screenshot 2: Instant Menu Allergen Radar Batch Dish Analysis](./screenshots/screenshot2.png)

### **3. Dining Out Mode & Digital Waiter Card Modal**
![Screenshot 3: Digital Waiter Card & Server Questions](./screenshots/screenshot3.png)

### **4. Daily Nutrition Budget & Allergen Dashboard**
![Screenshot 4: Daily Nutrition & Macronutrient Budget Dashboard](./screenshots/screenshot4.png)

### **5. Scan History & Profile Management (`/history` & `/profile`)**
![Screenshot 5: Scan History Log with Single & Bulk Deletion](./screenshots/screenshot5.png)

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

- **Project:** NutriGuard (Nutri-Buddy-Guard)
- **Author:** Ali Hamza
- **Repository:** [https://github.com/alihamza555777-cyber/nutri-buddy-guard](https://github.com/alihamza555777-cyber/nutri-buddy-guard)
- **Live URL:** [https://nutri-guard-buddy.vercel.app](https://nutri-guard-buddy.vercel.app)
