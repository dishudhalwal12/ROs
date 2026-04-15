**(\_\_\_\_ COLLEGE NAME \_\_\_\_)**

**(\_\_\_\_ CITY / CAMPUS ADDRESS \_\_\_\_)**

Affiliated to (\_\_\_\_ UNIVERSITY NAME \_\_\_\_)

(\_\_\_\_ ACCREDITATION / NAAC / ISO LINE, IF ANY \_\_\_\_)

**A**  
**Synopsis Report**  
**On**

**“Rovexa Team OS”**  
**Internal CRM, Task, Messaging and Operations Platform**

For Partial Fulfilment of (\_\_\_\_ DEGREE PROGRAM \_\_\_\_)  
((\_\_\_\_ PROGRAM SHORT FORM \_\_\_\_) (\_\_\_\_ BATCH YEARS \_\_\_\_))

| Submitted to (\_\_\_\_ PROFESSOR NAME \_\_\_\_) (\_\_\_\_ DESIGNATION \_\_\_\_) (\_\_\_\_ DEPARTMENT / COLLEGE SHORT NAME \_\_\_\_) | Submitted by (\_\_\_\_ MEMBER 1 NAME \_\_\_\_) (\_\_\_\_ MEMBER 2 NAME \_\_\_\_) (\_\_\_\_ MEMBER 3 NAME \_\_\_\_) |
| :---- | :---- |

**APRIL, 2026**

**TABLE OF CONTENTS**

| S. No. | Topic | Page No. |
| :---: | ----- | :---: |
| 1\. | Introduction | 3 |
| 2\. | Why Was This Topic Chosen? | 4 |
| 3\. | Objectives and Scope | 5 |
| 4\. | Methodology | 6 |
| 5\. | Technology Stack | 7 |
| 6\. | Testing Technologies Used | 8 |
| 7\. | Limitations and Future Scope | 9 |
| 8\. | Team Work Distribution | 10 |
| 9\. | Conclusion | 11 |

# **1\. INTRODUCTION**

Growing a small service company sounds simple from the outside. A founder closes a client, the team starts working, tasks get assigned, and delivery moves forward. In real life it gets messy very fast. One client conversation sits in WhatsApp, another in email, one task is written in a notebook, and payment follow-up is remembered only because someone happened to call. That kind of setup works for a while. Then it starts breaking.  
We noticed the same thing while planning how a young growth company like Rovexa would actually run day to day. A single project can involve proposals, internal discussions, task assignment, deadline tracking, file sharing, billing reminders, and client notes. If all of that lives in different places, the team spends more time asking for updates than doing the work itself. That was the problem we wanted to solve.

## **1.1 Problem Statement**

### **Problems Faced by a Small Team:**

**1\.** Tasks are often discussed in chat but not converted into proper action items, so work gets delayed even when everyone thinks it is clear.  
**2\.** Client details, proposal history, and follow-up notes stay scattered across calls, messages, and files, which makes the CRM side weak.  
**3\.** There is no quick way to ping the right teammate, see who is responsible, and check whether something is waiting, in progress, or done.

### **Problems Faced by Founders and Managers:**

**1\.** They do not get one clean view of leads, active projects, team workload, pending payments, and overdue items in the same place.  
**2\.** Performance reviews become guesswork because time logs, task completion, and accountability data are not captured together.  
**3\.** Meeting notes and decisions are forgotten because they are not linked back to clients, deals, or project boards.  
We built Rovexa Team OS as one internal platform where the team can message each other, assign work, manage deals, store files, track time, review performance, and monitor revenue flow. We kept the idea practical. It is not meant to be a flashy social app for teams. It is meant to help a growing business stay organized without needing five different tools.

# **2\. WHY WAS THIS TOPIC CHOSEN?**

The idea came from a very ordinary business problem. A small team usually does not fail because people are lazy. It struggles because the work is spread across too many disconnected places. One of us kept coming back to the same thought: if Rovexa wants to position itself as a systems-driven growth company, then our own internal work should not run on scattered chats and memory. That felt inconsistent.

## **2.1 What We Noticed Was Missing**

When we looked at common team tools, most of them solved only one part of the problem. Task tools handled tasks. CRMs handled leads. Chat apps handled messages. Billing tools handled invoices. But a small founder-led team does not experience these as separate worlds. A client call becomes a proposal, the proposal becomes tasks, the tasks become delivery, and delivery becomes billing. We wanted one app that respected that full flow.

## **2.2 Why This App Made Sense for Our Use Case**

The app also made sense technically. Firebase gives authentication, cloud database, and hosting in one setup. That matters when the team size is small and speed matters. We also wanted the product to feel modern and sharp, including a dark mode interface, because teams spend hours inside internal tools. If the dashboard feels cluttered or tiring, people stop using it. We did not want that.

## **2.3 What We Personally Got Out of It**

None of us had built a full internal operations platform before. A task board is one thing. A connected app with messaging, CRM, notes, files, project boards, alerts, time tracking, and billing logic is another. That stretch is exactly why we picked it. It was ambitious for our current skill level, but it also felt real, and that made the project worth doing.

# **3\. OBJECTIVES AND SCOPE**

The main things we wanted the app to do:  
**1\.** Build a role-based dashboard where each team member can see their tasks, priorities, alerts, and recent activity the moment they log in.  
**2\.** Create an internal messaging module with direct messages, project channels, mentions, and quick pings for urgent updates.  
**3\.** Set up a CRM section that stores lead details, deal stages, client notes, proposals, and next follow-up actions in one place.  
**4\.** Add vertical-wise project boards so work can move clearly from to-do to in progress, review, and done.  
**5\.** Include time tracking, meeting notes, and accountability features so team effort can be reviewed properly later.  
**6\.** Create file and document storage linked to clients, projects, and proposals so no one has to search multiple apps.  
**7\.** Show revenue, billing, payment status, and overdue invoices in a simple founder-level panel that supports daily decisions.

## **3.1 What the System Covers**

Rovexa Team OS covers the internal flow of a small growth company. It starts with leads and proposals, then moves into project creation, task distribution, discussion, tracking, file handling, team review, and billing. The intended users are founders, managers, and team members who need one place to manage both work and coordination.  
We kept some things out on purpose. This version does not try to replace full accounting software, large enterprise HR systems, or advanced customer support platforms. We also avoided adding too many analytics screens in the first version because that usually makes small products heavy and confusing. We wanted the scope to stay useful, not bloated.

# **4\. METHODOLOGY**

We did not follow any strict methodology by the book. There was no heavy documentation phase and no formal sprint ritual. What we did instead was break the work into practical stages and keep the feedback loop short. We also planned to use AI-assisted tools while building, especially for repetitive UI scaffolding, Firebase rules, and cleaning up logic when the app started growing.

## **4.1 Requirement Gathering**

We started by listing the exact modules the app needed: dashboard, tasks, messages, CRM, notes, proposals, time tracking, billing, notifications, and file storage. After that, we traced how these modules connect in a real workday. For example, a lead should not stay only in CRM. It should move into a deal, then into a project, then into assigned work. That flow shaped the whole project.

## **4.2 System Design**

The next step was mapping the app into pages, data collections, and user roles. We planned a dark mode-first interface with a sharp corporate look because the product is meant for regular team use, not a one-time demo. We also decided early that each important item should be linkable across modules. A meeting note should point to a client. A task should point to a project. An invoice should point to a deal or retainer.

## **4.3 Development Approach**

On the development side, we planned a React-based frontend with Firebase as backend. Firebase Authentication would handle secure login, Firestore would manage structured operational data, Realtime Database would support fast chat and live presence, and Firebase Hosting would handle deployment. The difficult part was not any one screen. It was keeping all these modules connected without making the app feel overloaded.

## **4.4 Testing and Iteration**

Once the core modules were in place, the plan was to test each flow one by one. We would create leads, convert them into active projects, assign tasks, log time, send messages, attach notes, and check whether billing and alerts reflected the same reality. That kind of full-flow testing matters a lot more here than isolated button testing. If the pieces do not talk to each other, the app fails its purpose.

# **5\. TECHNOLOGY STACK**

We picked tools based on three things: they had to be practical, quick to set up, and realistic for a student-level full-stack project. We also wanted a stack that could scale later without forcing a complete rewrite.

## **5.1 Frontend**

• React.js / Next.js style component structure — used to build the dashboard, boards, forms, and modular screens in a clean and reusable way.  
• Bootstrap 5 and custom CSS — used to create the sharp corporate layout, dark mode theme, cards, tables, and responsive panels.  
• JavaScript (ES6+) — used for client-side logic, validation, filters, live UI updates, and connected interactions across modules.

## **5.2 Backend and Database**

• Firebase Authentication — used for secure login, user sessions, and role-based access for founder, manager, and team members.  
• Cloud Firestore — used for CRM records, tasks, proposals, projects, notes, invoices, and structured operational data.  
• Firebase Realtime Database — used for team messaging, quick pings, unread counters, and online presence where faster live updates matter.  
• Firebase Hosting — used to deploy the web application quickly with minimal server management.

## **5.3 Extra Services**

• Firebase Storage — used for proposal files, attachments, internal documents, and client assets linked to projects.  
• Cloud Functions, if needed later — useful for automated reminders, invoice status checks, and notification logic that should run on the backend.  
• GitHub — used for version control, branch-based work, and keeping the development process organized.

# **6\. TESTING TECHNOLOGIES USED**

We did not plan to depend on any heavy automated testing framework in the beginning. Everything important would first be tested manually because this kind of internal app is more about real workflow correctness than textbook testing coverage. That is the honest answer.

## **6.1 Functional Testing**

Each module would be tested on its own first. Task creation, task assignment, message sending, lead entry, proposal update, note attachment, invoice creation, and time logging all need to work correctly before they are connected. We would also test bad inputs like missing fields, wrong dates, blank messages, and duplicate client records.

## **6.2 Integration Testing**

The most important testing would be integration testing. For example, when a deal moves to active, does a project get created cleanly? When a project is created, can tasks, notes, and documents be linked to it without confusion? When time is logged, does performance tracking update correctly? This is where apps like this usually break. We expected to spend the most time here.

## **6.3 Usability Testing**

We also planned usability checks with real users inside the team. A founder should be able to open the app and understand the health of the business in a few seconds. A teammate should know what is due today without clicking through five screens. If someone feels lost, the design has failed even if the code is correct.

## **6.4 Security Testing**

Security testing would focus on role boundaries. A team member should not see restricted revenue settings by mistake. One person should not be able to edit another person’s private notes if that rule is disabled. File access, chat permissions, and billing visibility all need to respect user roles. Firebase rules make this possible, but writing them carefully is a project in itself.

# **7\. LIMITATIONS AND FUTURE SCOPE**

## **7.1 Current Limitations**

• The first version depends on internet connectivity because Firebase-backed live modules like chat and sync need an active connection.  
• Advanced reporting is limited. The app can show clear operational data, but very deep business intelligence dashboards are outside the first version.  
• The billing section is meant for internal tracking, not full legal accounting or tax filing.  
• A small team can build the platform, but polishing all modules to production depth will still take time and repeated iteration.  
• Too many features in one screen can make the app feel heavy, so design discipline is necessary all the way through.

## **7.2 Future Scope**

• Add mobile push notifications for mentions, urgent pings, approvals, and overdue work.  
• Introduce smarter automation like reminder rules, auto-created follow-up tasks, and recurring retainer workflows.  
• Expand analytics to include conversion rates, team utilization, revenue by vertical, and project profitability.  
• Add AI-based summaries for meetings, client updates, and proposal notes so the founder can review faster.  
• Turn the internal product into a white-label or SaaS-style system later if the team wants to offer it commercially.

# **8\. TEAM WORK DISTRIBUTION**

The work split was based on comfort level, but not in a rigid way. In projects like this, strict boundaries sound neat on paper but are not always realistic. Some overlap is actually useful because integration problems show up only when more than one person understands the flow.

## **8.1 Member 1 – Frontend and Interface Design**

The first team member would handle the dashboard layout, dark mode styling, navigation structure, forms, cards, tables, project boards, and overall screen experience. This role also includes making sure the product feels sharp and corporate instead of looking like a student demo. That visual discipline matters more than people think.

## **8.2 Member 2 – Backend, Data and Logic**

The second team member would set up Firebase Authentication, Firestore collections, chat data flow, access rules, task logic, CRM relationships, and billing data structure. This role carries a lot of hidden complexity because the app only feels simple on the surface if the data model underneath is clean.

## **8.3 Member 3 – Testing, Integration and Deployment**

The third team member would support integration testing, Firebase Hosting setup, file storage flows, notification checks, and polishing the connected journey from lead to delivery to billing. In small teams this person usually also helps with bug fixing across both frontend and backend, which is why the role is broader.

## **8.4 Shared Work**

Requirement planning, module prioritization, final reviews, and presentation preparation would be shared. We also expected that difficult bugs, especially in permissions and cross-module linking, would be solved together. Those are rarely one-person problems. They usually need two people staring at the same issue until it makes sense.

# **9\. CONCLUSION**

The original problem was not a lack of tools. It was a lack of connection between tools. Rovexa Team OS is our attempt to bring the important internal parts of a small growth company into one organized system.  
The app covers messaging, CRM, tasks, project boards, notes, proposals, files, time logs, alerts, performance review, and billing visibility in one place. That is the core value of the idea. A founder should not have to jump across unrelated apps just to understand what is going on in the business today.  
We also learned that connected products are harder than they first appear. Building one feature is easy compared to making every feature support the same workflow. Firebase made the backend realistic for us, but it did not remove the need for careful thinking. We would still need to solve data structure, permissions, and interface clarity properly.  
In the end, this project is not about building something flashy for presentation marks. It is about building something a real team could actually use. We tried to make it practical, detailed, and grounded in how work really happens. We think that is what makes the project worth submitting.

**\* \* \* End of Synopsis \* \* \***