# TEMPO Directory - Technical Documentation

**Last Updated:** March 17, 2026  
**Version:** 1.0.0  
**License:** ISC

---

## 1. Project Overview

The **TEMPO** project is a Node.js/Express-based API service designed to integrate Jira and Tempo time-tracking systems. The application provides a dropdown API endpoint that dynamically fetches and returns Jira field options based on Tempo account attributes.

### Purpose
- Bridges Tempo (work attribute tracking) and Jira (issue tracking) systems
- Provides dynamic dropdown options for Jira custom fields
- Handles Tempo verification and API callbacks
- Implements efficient caching mechanisms

---

## 2. Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Express** | ^5.2.1 | Web framework for API server |
| **Axios** | ^1.13.6 | HTTP client for API requests |
| **dotenv** | ^17.3.1 | Environment variable management |
| **Node.js** | (runtime) | JavaScript runtime environment |

---

## 3. Project Structure

```
tempo/
├── .env                          # Environment variables (credentials)
├── .git/                         # Git version control
├── .gitignore                    # Git ignore rules
├── node_modules/                 # NPM dependencies
├── package.json                  # Project metadata & dependencies
├── package-lock.json             # Dependency lock file
├── server.js                     # Main application file
└── TECHNICAL_DOCUMENTATION.md    # This documentation file
```

---

## 4. Dependencies

### Production Dependencies

1. **express** (^5.2.1)
   - Core web framework
   - Handles HTTP routing and middleware
   - Enables `app.get()` and server listening

2. **axios** (^1.13.6)
   - Promise-based HTTP client
   - Handles authentication (basic auth for Jira, Bearer tokens for Tempo)
   - Used for API requests to Jira and Tempo

3. **dotenv** (^17.3.1)
   - Loads environment variables from `.env` file
   - Secures sensitive credentials (API tokens, emails)
   - Isolates configuration from code

---

## 5. Environment Configuration

The `.env` file contains the following required variables:

```
JIRA_DOMAIN=<atlassian_instance_url>           # Jira Cloud domain
JIRA_EMAIL=<jira_user_email>                   # Jira account email
JIRA_API_TOKEN=<jira_api_token>                # Jira API token for authentication
TEMPO_BEARER_TOKEN=<tempo_api_token>           # Tempo API bearer token
```

### Security Note
The `.env` file contains sensitive credentials and should **never** be committed to version control. Ensure it's listed in `.gitignore`.

---

## 6. Core Functions

### 6.1 `decodeHTML(str)`
**Purpose:** Decodes HTML entities in strings  
**Parameters:** `str` (String)  
**Returns:** Decoded string  
**Functionality:**
- Converts `&amp;` → `&`
- Converts `&lt;` → `<`
- Converts `&gt;` → `>`
- Converts `&quot;` → `"`
- Converts `&#39;` → `'`

---

### 6.2 `getAllJiraFields()`
**Purpose:** Fetches all available Jira fields  
**Authentication:** Basic Auth (Email + API Token)  
**Returns:** Array of field objects  
**Key Features:**
- Pagination support (100 items per request)
- Loops until all fields are retrieved
- Logs total field count
- Endpoint: `${JIRA_DOMAIN}/rest/api/3/field/search`

---

### 6.3 `getJiraFieldId(accountName)`
**Purpose:** Retrieves Jira field ID by account name  
**Parameters:** `accountName` (String)  
**Returns:** Field ID or `null`  
**Implementation:**
- Checks in-memory cache first (`fieldCache`)
- Fetches all fields if not cached
- Case-insensitive string matching with HTML decoding
- Stores result in cache for future requests

---

### 6.4 `getFieldContexts(fieldId)`
**Purpose:** Fetches all contexts for a specific Jira field  
**Parameters:** `fieldId` (String)  
**Returns:** Array of context objects  
**Endpoint:** `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context`

---

### 6.5 `getContextOptions(fieldId, contextId)`
**Purpose:** Retrieves options/values for a field context  
**Parameters:** `fieldId` (String), `contextId` (String)  
**Returns:** Array of option objects  
**Endpoint:** `${JIRA_DOMAIN}/rest/api/3/field/${fieldId}/context/${contextId}/option`

---

### 6.6 `getJiraOptions(fieldId)`
**Purpose:** Fetches and formats all Jira options for a field  
**Parameters:** `fieldId` (String)  
**Returns:** Array of formatted options `[{ key, value }, ...]`  
**Logic:**
- Iterates through all field contexts
- Returns first context with available options
- Formats options with HTML decoding
- Logs retrieved option values

---

### 6.7 `getTempoAccountName(uuid)`
**Purpose:** Converts Tempo UUID to account name  
**Parameters:** `uuid` (String)  
**Returns:** Account name or `null`  
**Authentication:** Bearer Token  
**Error Handling:** Catches and logs Tempo API errors  
**Endpoint:** `https://api.tempo.io/4/work-attributes/_Account1_`

---

### 6.8 Main API Endpoint: `GET /tasks`
**Purpose:** Primary API endpoint for dropdown data retrieval  
**Query Parameters:**
- `callback` (optional, default: "fn") - JSONP callback function name
- `tempoVerificationToken` (optional) - For Tempo verification
- `firstAttr` - Tempo UUID for account lookup
- Additional field parameters (key-value pairs)

**Response Format:** JSONP (JSON with Padding)
```javascript
fn({ values: [...] })
```

**Process Flow:**
1. Logs incoming request parameters
2. Handles Tempo verification if token present
3. Extracts field name and value from query params
4. If field is `firstAttr`:
   - Converts Tempo UUID to account name
   - Retrieves Jira field ID from account name
   - Fetches Jira options for that field
5. Returns formatted JSONP response with values array
6. Logs response time

---

## 7. Data Flow Diagram

```
User Request (GET /tasks?firstAttr=<uuid>&callback=cb)
        ↓
[Tempo Verification Check]
        ↓
[Extract Parameters: firstAttr=uuid]
        ↓
getTempoAccountName(uuid)
        ↓ (UUID → Account Name)
getJiraFieldId(accountName)
        ↓ (Account Name → Field ID)
getJiraOptions(fieldId)
        ↓ (Field ID → Options Array)
[Format Response as JSONP]
        ↓
Return: cb({ values: [...] })
```

---

## 8. Caching Mechanism

**In-Memory Field Cache:** `fieldCache = {}`
- Maps: `accountName` → `fieldId`
- Purpose: Reduces API calls to Jira
- Scope: Per server instance
- Duration: Until server restart
- Lookup: `fieldCache[accountName]`

---

## 9. Server Configuration

**Port:** 3000  
**Startup Message:** `"Tempo dropdown API running on port 3000"`  
**Request Logging:** Enabled (console.log for debugging)  
**Response Timing:** Tracked with `console.time()` and `console.timeEnd()`

---

## 10. API Usage Examples

### Example 1: Fetch dropdown options
```
GET http://localhost:3000/tasks?firstAttr=some-uuid-123&callback=myCallback
```

**Response:**
```javascript
myCallback({"values":[{"key":"Option1","value":"Option1"},{"key":"Option2","value":"Option2"}]})
```

### Example 2: Tempo Verification
```
GET http://localhost:3000/tasks?tempoVerificationToken=verification-token-123
```

**Response:** 
```
HTTP 200 OK
Header: X-Tempo-Verification-Token: verification-token-123
Body: "Tempo verification successful"
```

---

## 11. Error Handling

- **Tempo API Errors:** Caught and logged, returns empty values array
- **Missing Account Name:** Throws error, caught and logged, returns empty values
- **Missing Jira Field:** Throws error, caught and logged, returns empty values
- **Response Headers:** Content-Type set to `application/javascript` for JSONP

---

## 12. Running the Application

### Prerequisites
- Node.js installed
- `.env` file configured with credentials
- Internet access to Jira and Tempo APIs

### Installation
```bash
npm install
```

### Start Server
```bash
node server.js
```

### Expected Output
```
Tempo dropdown API running on port 3000
```

---

## 13. Performance Considerations

1. **Caching**: Field ID cache reduces repeated Jira API calls
2. **Pagination**: Handles up to 100 Jira fields per request
3. **Context Iteration**: Stops at first context with available options
4. **JSONP Format**: Reduces cross-origin request issues

---

## 14. Security Considerations

⚠️ **Important Security Notes:**
1. **API Credentials:** Never commit `.env` file to version control
2. **Bearer Tokens:** Should be rotated regularly
3. **Jira API Token:** Tied to user account - revoke if compromised
4. **JSONP Callback:** User-controlled parameter - potential XSS vector if not validated
5. **HTML Decoding:** Necessary for safe field name comparison

---

## 15. Integration Points

### Jira Integration
- **Type:** REST API v3
- **Authentication:** Basic Auth (Email + API Token)
- **Endpoints Used:**
  - `/rest/api/3/field/search` - List fields
  - `/rest/api/3/field/{id}/context` - Get field contexts
  - `/rest/api/3/field/{id}/context/{contextId}/option` - Get context options

### Tempo Integration
- **Type:** REST API v4
- **Authentication:** Bearer Token
- **Endpoints Used:**
  - `/4/work-attributes/_Account1_` - Get account data

---

## 16. Maintenance and Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Account name not found" | Invalid Tempo UUID | Verify UUID format and Tempo token validity |
| "Jira field not found" | Account name doesn't match field name | Check field naming in Jira |
| Empty values array | No options in field contexts | Verify field has options configured |
| 401 Unauthorized | Invalid credentials | Refresh API tokens in `.env` |
| Timeout errors | Network/API issues | Check Jira/Tempo API availability |

### Debugging
- Enable console logs to trace requests
- Check Response time with `console.timeEnd()` output
- Verify field cache with additional logging

---

## 17. Future Enhancements

- Database-backed caching instead of in-memory
- Rate limiting for API protection
- Request validation and sanitization
- Comprehensive error codes
- API versioning support
- Unit and integration tests
- Input validation for callback parameter

---

## 18. References

- [Express.js Documentation](https://expressjs.com/)
- [Axios Tutorial](https://axios-http.com/)
- [Jira REST API v3](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [Tempo API Documentation](https://apidocs.tempo.io/)
- [Node.js dotenv](https://github.com/motdotla/dotenv)

---

**End of Technical Documentation**
