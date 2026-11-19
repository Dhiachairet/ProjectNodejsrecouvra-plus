Open issues: 26

| Type | Impact | Location | Message | Rule |
|---|---|---|---|---|
| bug | reliability medium | `frontend/src/components/TransitionControl.jsx:39` | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. | `javascript:S9383` |
| bug | reliability medium | `frontend/src/pages/ClientDetail.jsx:26` | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. | `javascript:S9383` |
| bug | reliability medium | `frontend/src/pages/InvoiceDetail.jsx:119` | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. | `javascript:S9383` |
| code smell | reliability medium, maintainability low | `frontend/src/pages/Login.jsx:14` | Remove this "autoFocus" attribute, as it can reduce usability and accessibility for users. | `javascript:S9379` |
| code smell | reliability high, maintainability high | `scripts/seed.js:19` | Use `Math.trunc` instead of `\| 0`. | `javascript:S7767` |
| vulnerability | security low | `src/app.js:23` | This framework implicitly discloses version information by default. Make sure it is safe here. | `javascript:S5689` |
| vulnerability | security medium | `src/app.js:30` | Make sure that enabling CORS is safe here. | `javascript:S5122` |
| code smell | reliability medium, maintainability low | `src/controllers/client.controller.js:31` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/client.controller.js:31` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/client.controller.js:43` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/client.controller.js:52` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/client.controller.js:53` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/collection.controller.js:49` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/collection.controller.js:49` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/collection.controller.js:62` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/collection.controller.js:80` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/collection.controller.js:81` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/invoice.controller.js:47` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/invoice.controller.js:47` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/invoice.controller.js:59` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/invoice.controller.js:80` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| code smell | reliability medium, maintainability low | `src/controllers/invoice.controller.js:81` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| vulnerability | security high | `src/models/Client.js:15` | Fix this regular expression that is vulnerable to exponential backtracking, as it can lead to denial of service. | `javascript:S5852` |
| vulnerability | security high | `src/models/User.js:11` | Fix this regular expression that is vulnerable to exponential backtracking, as it can lead to denial of service. | `javascript:S5852` |
| code smell | reliability medium, maintainability low | `src/models/User.js:47` | Prefer `Number.parseInt` over `parseInt`. | `javascript:S7773` |
| bug | reliability medium | `src/server.js:39` | Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. | `javascript:S9383` |
