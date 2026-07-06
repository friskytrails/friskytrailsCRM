# Agent Metrics API Documentation

These endpoints manage the retrieval and updating of agent performance metrics and attendance logs. All routes are protected by the `auth` middleware (requiring a valid JWT).

---

## 1. Get Agent Metrics
Retrieves the current monthly target, completed target, and today's attendance status for a specific agent.

**Endpoint:** `GET /api/agents/:id/metrics`  
**Access:** **Admins** (can view any agent) & **Agents** (can only view their own ID).

### Request
- **URL Params:** `id` (String, required) - The `ObjectId` of the agent.

### Responses
**Success (200 OK)**
```json
{
  "monthlyTarget": 50,
  "targetCompleted": 12,
  "attendance": "P"
}
```

**Errors:**
- **400 Bad Request:** `{ "error": "Invalid agent ID format" }` (If `:id` is not a valid ObjectId).
- **403 Forbidden:** `{ "error": "Forbidden: Admin access only" }` (If an agent tries to fetch another agent's metrics).
- **404 Not Found:** `{ "error": "Agent not found" }`
- **500 Internal Server Error:** `{ "error": "Internal server error" }`

---

## 2. Update Agent Metrics
Updates an agent's monthly target, completed target, or attendance for a specific date. If attendance is provided, it will also log/update the historical attendance record for that date.

**Endpoint:** `PUT /api/agents/:id/metrics`  
**Access:** **Admins Only**.

### Request
- **URL Params:** `id` (String, required)
- **Body (JSON):**
  - `monthlyTarget` (Number, optional)
  - `targetCompleted` (Number, optional)
  - `attendance` (String, optional) - Allowed values: `"P"` (Present), `"A"` (Absent), `""` (Clear/Delete).
  - `attendanceDate` (String, optional) - Format: `YYYY-MM-DD`. Defaults to today if omitted.

### Responses
**Success (200 OK)**
Returns the updated `Agent` object.

**Errors:**
- **400 Bad Request:**
  - `{ "error": "Invalid agent ID format" }`
  - `{ "error": "Cannot update metrics of an admin user" }`
  - `{ "error": "Invalid monthlyTarget" }` (If negative or not a number)
  - `{ "error": "Invalid targetCompleted" }`
- **403 Forbidden:** `{ "error": "Forbidden: Admin access only" }`
- **404 Not Found:** `{ "error": "Agent not found" }`
- **500 Internal Server Error:** `{ "error": "Internal server error" }` *(e.g., if attendance log fails to persist)*

---

## 3. Get Agent Attendance Logs
Retrieves the complete historical array of daily attendance logs for a specific agent.

**Endpoint:** `GET /api/agents/:id/attendance`  
**Access:** **Admins Only**.

### Request
- **URL Params:** `id` (String, required)

### Responses
**Success (200 OK)**
Returns an array of attendance objects sorted by date.
```json
[
  {
    "id": "60d5ecb8b487343568912345",
    "agentId": "60d5ec49b487343568911111",
    "date": "2026-07-05",
    "status": "P",
    "__v": 0
  },
  {
    "id": "60d5ecb8b487343568912346",
    "agentId": "60d5ec49b487343568911111",
    "date": "2026-07-06",
    "status": "A",
    "__v": 0
  }
]
```

**Errors:**
- **400 Bad Request:** `{ "error": "Invalid agent ID format" }`
- **403 Forbidden:** `{ "error": "Forbidden: Admin access only" }`
- **404 Not Found:** `{ "error": "Agent not found" }`
- **500 Internal Server Error:** `{ "error": "Internal server error" }`
