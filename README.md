# HealthNet – Rural Patient Health Wallet  

HealthNet is an offline-first digital patient health wallet designed to improve healthcare access, continuity, and efficiency in rural communities.

Built for Community Health Workers (CHWs), HealthNet enables secure patient record management, seamless data sharing, simplified medical explanations, and integrated payments — even in low-connectivity environments.

## Problem Statement  

Healthcare systems in rural Nigeria face critical challenges:  

- Fragmented, paper-based patient records  
- Loss of medical history across facilities  
- Low patient health literacy  
- Manual and untracked healthcare payments  
- Poor interoperability between systems  
- Limited internet connectivity  

These issues lead to delayed treatment, increased costs, and poor health outcomes.

## Solution  

HealthNet is a **portable digital patient health wallet built on an offline-first platform**, ensuring seamless continuity of care and improved healthcare delivery in underserved communities.

### Key Features  

- **Offline-First Architecture** – Works without internet and syncs automatically  
- **Patient Profile Management** – Secure patient registration and FHIR-aligned medical history tracking  
- **Visit Records** – Capture symptoms, diagnosis, and prescriptions with automated timestamps  
- **QR Code Sharing** – Encrypted, offline-capable record transfer between clinics  
- **AI Explanation Module** – Simplifies medical terminology for patients (includes safety disclaimer: *“For informational purposes only; consult a doctor”*)  
- **Integrated Payments** – Secure transaction processing via Interswitch with local offline logs  
- **CHW Dashboard** – Low-bandwidth optimized interface for managing patients and quick actions
  
## MVP Scope (7-Day Buildathon)  

The MVP focuses on core features to demonstrate value to CHWs and patients:  

- Patient registration (Name, Age, Gender, Allergies, FHIR-aligned medical history)  
- Visit records (symptoms, diagnosis, prescriptions)  
- Offline data storage with automatic cloud sync  
- QR-based record sharing between facilities  
- AI-powered simplified health explanations  
- Interswitch payment processing integration  

## Success Metrics  

- **Patient Registration:** ≥50 patients registered  
- **QR Record Transfers:** ≥20 completed  
- **AI Explanations Generated:** ≥15  
- **Payment Transactions:** ≥10 successful  
- **CHW Satisfaction Rating:** ≥80%  

## User Flow  

1. CHW logs into the mobile app  
2. Accesses dashboard for quick actions (Add Patient, Scan QR, AI Explanation, Payments)  
3. Registers patient (stored offline, queued for sync)  
4. Records visit details  
5. Shares patient records via encrypted QR code  
6. Uses AI module for simplified explanations (<2 seconds)  
7. Processes payment through Interswitch (offline verification logs)  
8. Data syncs automatically when connectivity is restored  

**Interactive Prototype:** [Lovable Prototype](https://lovable.dev/projects/8d1fde4b-5236-4f04-9be7-92266e91cd82?magic_link=mc_3dd3836f-9f3c-4845-97e4-a1d93a91be72)  
**User Flow Design:** [Lovable Workspace](https://us.docworkspace.com/d/sbEaanfVNcRyVydx_stuvc9i7c5qj0la7s1?sa=601.1037)  

## Documentation  

- **Full Product Requirement Document (PRD):** [Google Docs Link](https://docs.google.com/document/d/14qpdWRwV4lttm8EdH0-9BPvDcALZoTTrlsszykjXlrQ/edit?usp=sharing)  

## Functional Requirements  

- **FHIR Standard:** Patient data structures must be FHIR R4 compatible  
- **Conflict Resolution:** Timestamp-based “Last-Write-Wins” for offline sync conflicts  
- **QR Transfer:** Encrypted, offline-readable tokens for patient records  
- **Secure Payment Processing:** Interswitch API integration with local transaction logs  
- **CHW Dashboard:** Quick actions, AI explanations, patient management  

## Non-Functional Requirements  

- **Performance:**  
  - Patient records load <3 seconds  
  - QR scanning completes <2 seconds  
- **Usability:** Registration completed by CHW <2 minutes  
- **Offline Reliability:** ≥98% sync success rate once online  
- **Security:** AES-256 encryption at rest, NDPR-compliant consent for record sharing  

## Technical Architecture  

- **Frontend:** React Native (offline-first mobile app, local storage with SQLite/Hive)  
- **Backend:** Node.js + Express (FHIR-compliant APIs)  
- **Database:** Local-to-cloud sync architecture  
- **AI Module:** Gemini lightweight LLM for patient-friendly explanations  
- **Payments:** Interswitch API integration  
- **Security:** AES-256 encryption, NDPR compliance  

## 7-Day Development Roadmap  

- **Day 1:** Scope definition, FHIR schema design, project planning  
- **Day 2:** Backend setup (Node.js & Express), API development, database structure  
- **Day 3:** Frontend development (React Native) – patient registration, local storage  
- **Day 4:** QR code sharing, Gemini AI integration  
- **Day 5:** Interswitch payment integration, transaction flow testing  
- **Day 6:** End-to-end testing (offline sync, API validation, conflict resolution)  
- **Day 7:** Demo preparation, pitch deck finalization, team review
  
## Team Contributions  

**Lateefat Olatunji – Product Manager**  
- Defined product vision, PRD, MVP scope, success metrics, and validation approach  
- Managed Trello workflow, 7-day roadmap, and delivery  
- Collaborated with engineers on architecture and feature design  

**Usman Masud Aliyu – Software Developer**  
- Built mobile app and backend systems  
- Developed core features for patient management, QR sharing, AI integration, and payments  
- Implemented APIs, sync logic, and system architecture  

**Farida Muftau – Data Analyst**  
- Cleaned and analyzed survey data on patient record systems  
- Identified challenges and adoption readiness  
- Produced actionable insights and recommendations for MVP features  

**Tools Used:** Google Docs, Trello, Lovable, Excel/Sheets  

## Risks & Mitigation  

- **Low Connectivity:** Offline-first architecture with local caching  
- **Data Privacy Concerns:** NDPR compliance and AES-256 encryption  
- **Low Digital Literacy Among CHWs:** Simple, intuitive UI and minimal training  
- **Interoperability Challenges:** HL7 FHIR standards  

## Future Improvements  

- Maternal health tracking  
- Advanced drug history tracking  
- Enhanced referral tracking and reporting  
- Telemedicine consultations  
- Multi-language support  
- Predictive health analytics  

## Conclusion  

HealthNet provides a scalable, secure, and user-friendly solution to Nigeria’s fragmented healthcare system. By combining offline-first technology, AI-powered explanations, QR-based record sharing, and digital payments, HealthNet empowers Community Health Workers and improves healthcare outcomes in underserved communities.

## 🔗 Links  

- Prototype: https://lovable.dev/projects/8d1fde4b-5236-4f04-9be7-92266e91cd82  
- User Flow: https://us.docworkspace.com/d/sbEaanfVNcRyVydx_stuvc9i7c5qj0la7s1  

