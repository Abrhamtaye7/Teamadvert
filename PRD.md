Understood — here is your full **Production-Ready PRD** for **TEAM ADVERT PLC Business Management System**.

---

# **📘 PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **TEAM ADVERT PLC – Business Workflow Management System**

**Version:** 1.0
**Generated:** Today
**Modules:** Proforma Generator, Job Order System, CRM, Supplier Manager, Item Management, Finance, Production, Audit Logs, Authentication, Search Engine, Backup, Notifications, Payment Verification

---

# **1. SYSTEM OVERVIEW**

TEAM ADVERT PLC needs a centralized web application to manage:

* Proformas (TAPI)
* Job Orders (TAJO)
* Customer CRM
* Supplier Manager
* Item & Price Manager
* Finance & payments
* Production workflow
* Admin approvals
* Stock price tracking
* Activity logging
* Weekly backups
* Instant search
* CBE payment verification (PDF auto-parse)

The application will serve multiple roles and unify all business operations into one workflow.

---

# **2. CORE USER ROLES**

| Role                | Responsibilities                                                                     |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Admin**           | Approvals, editing prices, unlocking jobs, toggling permissions, system management   |
| **Finance**         | Payment verification, CBE TRX validation, marking “Paid in Full”, generating invoice |
| **Sales**           | Managing customers, creating proformas, updating notes                               |
| **Designer Team**   | Job creation, converting proforma → job order                                        |
| **Production Team** | Marking jobs as In Progress and Completed                                            |
| **All Users**       | Full transparency on item pricing and logs                                           |

Permissions are **toggleable** by Admin.

---

# **3. AUTHENTICATION & SECURITY**

### **Login**

* Username + 4-digit PIN
* Password/PIN reset supported
* Track login history:

  * IP
  * Time
  * Browser/Device
  * Last login timestamp

### **Security**

* Rate-limit failed logins
* Auto logout after inactivity
* All actions logged in audit history
* HTTPS enforced

---

# **4. DASHBOARD & REPORTING**

Each role sees a tailored dashboard.

### **General Dashboard Widgets**

* Daily Jobs (New, In Progress, Completed)
* Pending Approvals (Admin)
* Pending Payments (Finance)
* Sales totals (Daily/Weekly/Monthly)
* Top Customers
* Item Price Changes Summary
* Credit Alerts (customers above limit)
* Low Stock Alerts (if implemented later)

---

# **5. NOTIFICATIONS & ALERTS**

**On-screen notifications** (real-time):

* Proforma Approved
* Job Approved
* Job Completed
* Payment Pending
* Low Stock
* Price Changes
* Customer-specific alerts
* CBE Payment Verified / Rejected

---

# **6. FILE STORAGE (LOCAL PATH ONLY)**

Files are **NOT** uploaded.
System only stores:

* File name
* File location on local machine
* Metadata (user, timestamp)

Job order can quickly reference artwork without storing files.

---

# **7. AUDIT LOGGING**

System logs:

* Who edited what
* Timestamp
* Previous value
* New value
* Price change history (customer & supplier)
* Proforma → Job conversions
* Admin approvals
* Login logs
* Payment updates
* CBE TRX validation logs

All logs are immutable.

---

# **8. CUSTOMER CRM MODULE**

### **Customer Profile Fields**

* Name
* Company name
* Phone numbers
* Email
* Address (Region/City/Subcity/Woreda/House No)
* TIN
* Customer ID (unique)

### **Customer Activity History**

* Notes (manual)
* Price amendments
* New items
* Communication history
* Past proformas
* Past job orders
* Past invoices
* Payments history
* Credit history

### **Customer Credit Management**

* Credit limit
* Outstanding balance
* Last payment date
* Status:

  * Good standing
  * Warning
  * Suspended

### **CRM Search (Live Filter)**

Search by:

* Name
* Company
* Phone
* TIN
* Assigned jobs
* Outstanding balance
* Item purchased
* Price history filters
* Date of last contact

---

# **9. SUPPLIER CONTACT BOOK**

### **Supplier Fields**

* Supplier ID
* Company name
* Contact person
* Phone, email
* Address

### **Supplier Activity**

* Purchase price log (per item)
* Delivery history
* Notes
* Item-supplier relationship

### **Supplier Search**

* Live search by name
* Item supplied
* Purchase amount
* Price change history

---

# **10. ITEM & PRICE MANAGER**

### **Item Fields**

* Item name
* Category
* Unit (pcs/m²/hour/…)
* Purchase price **per supplier** (with logs)
* Selling price **per customer** (with logs)
* General selling price
* Notes
* Price change logs

### **Full Transparency Mode**

All users see:

* Purchase price
* Selling prices
* Profit differences
* Price logs

### **Logs**

* Customer price history
* Supplier purchase price history
* Date, user, old value, new value

---

# **11. PROFORMA MODULE (TAPI)**

### **Identifier Format**

========================================================
PROFORMA GENERATION WORKFLOW (TAPI)
========================================================

A. CUSTOMER VALIDATION & REGISTRATION WORKFLOW
   - When user begins creating a proforma:
       • System checks if the customer exists in the Customer Contact Book.
       • If NOT registered:
           - Prompt user to register customer directly inside the proforma creation flow.
           - Create Customer record in CRM with:
                - Name
                - Company name
                - Phone numbers
                - Email
                - Region, City, Sub-city, Woreda, House No
                - TIN number
                - Customer ID (auto-generated)
           - Store new customer in Customer Contact Book.
           - Continue with proforma creation.
       • If customer IS registered:
           - Auto-fill all customer snapshot details from CRM.
           - Lock snapshot to ensure future customer edits do not modify existing proformas.

========================================================
B. PROFORMA IDENTIFIER FORMAT
   - Auto-generate unique Proforma Number:
       TAPI-###-YY
   - Sequence resets each year.
   - Ensure no duplicate numbers.

========================================================
C. PROFORMA CREATION UI/UX
   - Form fields:
       • Customer (validated as above)
       • Date (auto-filled)
       • Prepared-by (current user)
       • Validity period (days)
       • Item List (dynamic rows):
            - Item ID
            - Item name
            - Description
            - Quantity
            - Unit
            - Price
            - Discount
            - VAT (15%)
            - Line total
       • Notes & terms
       • Digital signature path
       • Company stamp path
       • Company banking information snapshot
       • Amount in words (system-generated)

   - Totals auto-update dynamically.

========================================================
D. DATABASE STRUCTURE
   Backend schema must include:

   Table: customers
       id, name, company, phones, email, address json,
       tin, created_at, updated_at

   Table: proformas
       id
       proforma_number
       date
       prepared_by
       customer_id
       customer_snapshot JSON
       validity_period
       notes
       terms
       bank_snapshot JSON
       signature_path
       stamp_path
       amount_in_words
       status ENUM('draft','approved','converted','expired')
       created_at
       updated_at

   Table: proforma_items
       id
       proforma_id
       item_id
       item_name
       description
       quantity
       unit
       price
       discount
       vat_percent
       total
       created_at
       updated_at

========================================================
E. SNAPSHOT BEHAVIOR
   - Customer snapshot saved at time of creation.
   - Item pricing snapshot saved at time of creation.
   - Bank snapshot also saved.
   - Snapshots never update automatically.

========================================================
F. APPROVAL WORKFLOW
   - Status = DRAFT by default.
   - Admin can approve.
   - Once approved:
       • All fields become locked.
       • Status → APPROVED.
   - Log entry:
       “Proforma approved by {user} at {timestamp}”

========================================================
G. CONVERT TO JOB ORDER
   - Only allowed if status = APPROVED.
   - System auto-creates TAJO job order using proforma data.
   - Status → CONVERTED.
   - Log entry:
       “Converted to Job Order TAJO-###-YY by {user}”

========================================================
H. SEARCH & FILTER (LIVE FILTERING)
   - Implement instant search without reload.
   - Search fields:
       • Proforma number
       • Customer name
       • Date range
       • Status
       • Prepared-by
       • Item name
       • Amount range
   - Results update as user types.

========================================================
I. PRINT / EXPORT
   - Proforma must render a print-ready and PDF-export template with:
       • Logo
       • Company info
       • Customer snapshot
       • Items table
       • Subtotal / Discount / VAT / Grand total
       • Amount in words
       • Signature
       • Stamp
       • Bank info
       • Terms & notes

========================================================
J. ACCESS CONTROL
   - Designers & Sales: create proforma.
   - Admin: approve, lock, revoke.
   - All users: view and print.

========================================================
K. TESTING REQUIREMENTS
   After generating code, CODEx must automatically:
       • Validate routes, models, controllers, services.
       • Test customer auto-registration logic.
       • Test customer auto-fetch logic.
       • Test VAT, discount, total, and amount-in-words.
       • Test approval lock.
       • Test conversion to job order.
       • Test PDF export.
       • Test live search filters.
       • Validate database schema consistency.
       • Detect any missing modules or broken imports.
       • Fix all issues automatically before continuing.

========================================================


`TAPI-###-YY`
Example:

* TAPI-001-25
* TAPI-002-25

### **Proforma Fields**

**Header**

* Proforma Number
* Date
* Prepared by
* Validity period
* Customer (linked) + snapshot
* Amount in words

**Items**

* Item ID
* Name
* Description
* Quantity
* Unit
* Selling price
* Discount
* VAT 15%
* Line total

**Footer**

* Notes
* Terms
* Digital signature
* Company stamp path
* Bank info snapshot
* Status:

  * Draft
  * Approved
  * Converted
  * Expired

### **Proforma Actions**

* Create
* Edit (until approved)
* Convert to job order
* Duplicate
* Print/PDF

### **Proforma Search (Live)**

* By proforma number
* Customer name
* Amount range
* Prepared-by
* Item name
* Status
* Date range

---

# **12. JOB ORDER SYSTEM (TAJO)**

### **Identifier Format**

`TAJO-###-YY`

### **Job Creation (Designer)**

Required fields:

* Customer info
* Job description
* Item list
* Measurements
* Artwork path
* Deadline
* Priority
* Reference to proforma
* Price
* Advance payment
* Timestamp

### **Admin Approval**

Admin can:

* Edit prices / discounts
* Verify deadlines
* Verify priority
* Verify advance payment
* Add internal notes
* Lock job from designer edits

### **Production Stage**

Production can:

* Mark “In Progress”
* Mark “Completed”

### **Finance Stage**

Finance can:

* View total
* View advance payment
* Add payments
* Mark Paid in Full
* Mark Payment Pending
* Block delivery until paid
* Release job for delivery
* Generate final invoice
* Perform CBE TRX verification

### **Job History in Customer CRM**

All past job orders linked to customer.

---

# **13. CBE TRANSACTION VERIFICATION**

### **Input**

* Transaction number (e.g., FT25307KMJGN)
* Screenshot (optional)

### **Verification URL**

```
https://apps.cbe.com.et:100/?id={12digitTRX}57045219
```

### **System Steps**

1. System downloads official CBE PDF
2. Parse fields:

   * Receiver
   * Receiver Account
   * Reference No
   * Transferred Amount
3. Compare with mandatory rules:

   * Receiver = TEAM ADVERT PLC
   * Account = 1****5219
   * Reference No = transaction number
   * Amount = matches

### **If all match → Accept**

### **If mismatch → Show exact problem**

Logs stored in audit history.

---

# **14. SEARCH + FILTERING ENGINE**

The system supports **instant live filtering** for:

* Proformas
* Job orders
* Customers
* Suppliers
* Finance payments
* Items
* Price logs

Uses:

* Debounced search (fast)
* Indexed fields for speed
* Paginated results

---

# **15. DARK MODE / LIGHT MODE**

User preference stored per account.

---

# **16. BACKUP & RECOVERY**

### **Automatic Backup**

* Weekly (Sunday)
* Includes:

  * Database
  * Logs
  * Snapshots of proformas
  * Price logs
  * Customer/supplier histories

### **Recovery Panel**

Admin can:

* Download backup
* Restore from previous backup

---

# **17. TECH STACK**

### **Frontend**

* React
* React Router
* TailwindCSS
* State management (Zustand or Redux)

### **Backend**

* Node.js (Express)
* JWT Authentication
* PDF parser library for CBE receipts
* Cron jobs for weekly backups

### **Database**

* MySQL
* Relational structure
* Indexed search tables

### **Hosting**

* yegara.com (Ethiopia local host)

### **APIs**

* CBE transaction verifier
* Internal REST APIs for modules

---

# **18. DATABASE SCHEMA (HIGH-LEVEL)**

### **Tables**

* users
* roles
* permissions
* customers
* customer_price_history
* suppliers
* supplier_price_history
* items
* item_categories
* proformas
* proforma_items
* job_orders
* job_items
* payments
* audit_logs
* activity_logs
* credit_history
* backups
* notifications

Full schema can be generated if needed.

---

# **19. UI/UX WORKFLOW (ALL MODULES)**

Each module includes:

* List page
* View page
* Edit page
* Logs/history tab
* Actions (approve, convert, etc.)
* Live search
* Pagination

Clean, modern, dark/light toggle.

---

# **20. ACCEPTANCE CRITERIA (QA)**

### **System must:**

* Create proforma in under 1 second
* Convert proforma to job order correctly
* Restrict edits after approval
* Validate CBE transaction PDFs perfectly
* Log all user actions
* Run weekly backups
* Work offline with local file paths
* Load search results instantly
* Enforce 4-digit PIN security

### **No operation should:**

* Lose data
* Allow unauthorized price changes
* Allow job delivery before payment release
* Break links between customer and history

---

# 🎉 **PRD COMPLETE**

This PRD is production-ready and can be handed directly to a development team to start implementation.

If you'd like, I can now produce:

✅ API documentation
✅ Database ERD diagram
✅ User flow diagrams
✅ UI wireframes
✅ Development roadmap
✅ Cost/time estimation

Just tell me what you want next.
