# MiniZalo Backend

Backend service for MiniZalo, a real-time messaging and social communication application. The service is built with Spring Boot 3.2.1 and provides authentication, user profile management, friend relationships, private chat, group chat, realtime presence, media storage, calls, stories, posts, polls, notifications, analytics, and AI-assisted chat utilities.

## Overview

MiniZalo Backend is designed as a pragmatic modular backend for a course project. It keeps the main business logic in one Spring Boot application while separating responsibilities by controller, service, repository, DTO, model, security, and infrastructure configuration packages.

Core runtime responsibilities:

- Authenticate users with JWT access tokens and refresh tokens.
- Manage users, profiles, avatars, cover photos, online status, and FCM tokens.
- Manage friend requests, friend lists, blocking, and friend categories.
- Support private chat and group chat through REST and STOMP over WebSocket.
- Persist relational data in PostgreSQL and message-oriented data in DynamoDB.
- Store uploaded media through MinIO with S3-compatible access.
- Support realtime typing, read receipts, message reactions, pinned messages, forwarded messages, recalled messages, and unread context.
- Support social features such as posts, comments, reactions, stories, polls, and timeline privacy.
- Support call signaling with Agora integration.
- Provide AI utilities such as message summarization, persona chat, translation, text improvement, event extraction, and speech-to-text.
- Expose analytics endpoints for message, user activity, and overview metrics.

## Technology Stack

| Area | Technology |
| --- | --- |
| Language | Java 17 |
| Framework | Spring Boot 3.2.1 |
| Security | Spring Security, JWT, BCrypt |
| REST API | Spring Web MVC, Validation, Springdoc OpenAPI |
| Realtime | Spring WebSocket, STOMP, SockJS |
| Relational data | PostgreSQL 13 |
| Message data | AWS DynamoDB SDK, DynamoDB Local for development |
| Cache / presence | Redis |
| Media storage | MinIO, S3-compatible object storage |
| Push notification | Firebase Admin SDK |
| Call signaling | Agora token generation |
| AI integration | Gemini API key configured through environment variables |
| Build | Maven Wrapper |
| Local infrastructure | Docker Compose |
| Logging | Logback with logstash encoder |

## Main Features

### Authentication and Account

- Sign up, sign in, logout, refresh token.
- Change password.
- OTP flows for account verification and forgot password.
- QR login session generation, event stream, and confirmation.
- JWT authentication for protected REST APIs and WebSocket connections.

### Users and Presence

- Current user profile and public profile lookup.
- Profile update, avatar update, cover photo update.
- User search.
- Online heartbeat and custom status.
- FCM token update for push notifications.
- Mute and account lock operations.
- Contact synchronization.

### Friends

- Send, accept, reject, cancel friend requests.
- List friends, incoming requests, sent requests, and blocked users.
- Remove friend.
- Block and unblock users.
- Manage timeline privacy per friend.
- Create friend categories and assign friends to categories.

### Chat and Group Chat

- Private chat room creation.
- Room list and message history.
- Send message through REST or STOMP.
- Typing indicator.
- Read receipt.
- Message reactions.
- Pin messages and list pinned messages.
- Recall, forward, search, and delete messages.
- Delete chat history and chat rooms.
- Nickname and wallpaper per room.
- Unread context lookup.
- Create, update, delete, leave, and join groups.
- Add/remove members, update member role, transfer ownership.
- Group settings, invite link refresh, blocked members, and group events.

### Social, Story, and Polls

- Create posts with media.
- Feed listing.
- Comments and reactions.
- Post privacy update and deletion.
- Create stories, view stories, react to stories, update story privacy, and delete stories.
- Create polls, add options, vote, close, delete, and list polls by room.

### Media and Link Preview

- Upload file through `/api/files/upload`.
- Generate media pre-signed URL through `/api/media/presigned-url`.
- Generate link preview metadata through `/api/link-preview`.

### Calls

- Initiate direct call and group call.
- Join, leave, accept, reject, cancel, and end calls.
- Query pending calls and call history.
- Agora App ID and certificate are supplied through environment variables.

### AI Utilities

- Summarize room messages.
- View AI history for a room.
- Persona chat.
- Translate text.
- Improve text.
- Extract events from room messages.
- Speech-to-text endpoint.

## Project Structure

```text
MiniZalo_Backend/
|-- docker-compose.yml
|-- Dockerfile
|-- mvnw / mvnw.cmd
|-- pom.xml
`-- src/
    |-- main/
    |   |-- java/iuh/fit/se/minizalobackend/
    |   |   |-- config/          # WebSocket, MinIO, DynamoDB, Firebase, OpenAPI, model mapping
    |   |   |-- controllers/     # REST controllers and STOMP message handlers
    |   |   |-- dtos/            # Request/response DTOs
    |   |   |-- exception/       # Global and custom exception handling
    |   |   |-- models/          # JPA entities, DynamoDB models, enums
    |   |   |-- payload/         # Auth/chat payload models kept for compatibility
    |   |   |-- repository/      # JPA repositories and DynamoDB repository adapter
    |   |   |-- security/        # JWT, Spring Security, WebSocket auth
    |   |   `-- services/        # Business services and implementations
    |   `-- resources/
    |       |-- application.properties
    |       `-- logback-spring.xml
    `-- test/                    # Unit, controller, and integration tests
```

## Prerequisites

Install these tools before running the project:

- Java 17 or newer.
- Docker Desktop and Docker Compose.
- Git.
- Optional: Postman or another REST client.

## Environment Variables

Create a `.env` file in `MiniZalo_Backend/` before running Docker Compose.

```env
DB_USERNAME=minizalo_user
DB_PASSWORD=minizalo_password

AWS_ACCESS_KEY_ID=dummy
AWS_SECRET_ACCESS_KEY=dummy
AWS_REGION=ap-southeast-1

MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=minizalo-media
MINIO_PUBLIC_URL=http://localhost:9000

JWT_SECRET_KEY=change_this_to_a_long_random_secret_at_least_32_chars
APP_ACCESS_TOKEN_EXPIRATION_MINUTES=60
APP_REFRESH_TOKEN_EXPIRATION_DAYS=30

MAIL_USERNAME=your_gmail@gmail.com
MAIL_PASSWORD=your_gmail_app_password

GEMINI_API_KEY=your_gemini_api_key
AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
```

Notes:

- For local DynamoDB, dummy AWS credentials are acceptable.
- Gmail SMTP requires an app password, not the normal Gmail password.
- Keep real secrets out of Git.

## Run Locally With Docker Compose

From `MiniZalo_Backend/`:

```bash
docker compose up -d --build
```

This starts:

| Service | URL / Port | Purpose |
| --- | --- | --- |
| Backend | `http://localhost:8080` | Spring Boot API |
| PostgreSQL | `localhost:5432` | User, room, friend, group, social data |
| DynamoDB Local | `http://localhost:8000` | Message-oriented storage |
| MinIO API | `http://localhost:9000` | Media object storage |
| MinIO Console | `http://localhost:9001` | Storage administration |
| Redis | `localhost:6379` | Presence/cache support |

Useful commands:

```bash
# See running services
docker compose ps

# View backend logs
docker compose logs -f minizalo-backend

# Stop services
docker compose down

# Stop and remove local volumes
docker compose down -v
```

## Run Backend Without Docker

Start infrastructure only:

```bash
docker compose up -d minizalo-db dynamodb-local minio createbuckets redis
```

Then run the Spring Boot app:

```bash
./mvnw spring-boot:run
```

On Windows PowerShell:

```powershell
.\mvnw.cmd spring-boot:run
```

## API Documentation

After the backend starts, open:

```text
http://localhost:8080/swagger-ui/index.html
```

OpenAPI JSON:

```text
http://localhost:8080/v3/api-docs
```

## Important REST Endpoints

### Auth

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Register a new user |
| POST | `/api/auth/signin` | Login and receive JWT tokens |
| POST | `/api/auth/refreshtoken` | Refresh access token |
| POST | `/api/auth/logout` | Logout current user |
| POST | `/api/auth/change-password` | Change password |
| POST | `/api/auth/send-otp` | Send OTP |
| POST | `/api/auth/verify-otp` | Verify OTP |
| POST | `/api/auth/forgot-password/send-otp` | Send forgot-password OTP |
| POST | `/api/auth/reset-password` | Reset password |
| GET | `/api/auth/qr-login/generate` | Generate QR login session |
| GET | `/api/auth/qr-login/events/{sessionId}` | Subscribe to QR login SSE events |
| POST | `/api/auth/qr-login/confirm` | Confirm QR login |

### User and Friend

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/users/me` | Current user profile |
| PUT | `/api/users/profile` | Update profile |
| PUT | `/api/users/avatar` | Update avatar |
| PUT | `/api/users/cover-photo` | Update cover photo |
| GET | `/api/users/search` | Search users |
| GET | `/api/users/profile/{userId}` | Public user profile |
| POST | `/api/users/heartbeat` | Update online heartbeat |
| POST | `/api/friends/request` | Send friend request |
| POST | `/api/friends/accept/{requestId}` | Accept friend request |
| DELETE | `/api/friends/reject/{requestId}` | Reject friend request |
| GET | `/api/friends` | List friends |
| GET | `/api/friends/requests` | Incoming friend requests |
| GET | `/api/friends/requests/sent` | Sent friend requests |
| POST | `/api/friends/block/{userId}` | Block user |
| DELETE | `/api/friends/block/{userId}` | Unblock user |

### Chat

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/chat/rooms` | List chat rooms |
| POST | `/api/chat/rooms/private/{userId}` | Create or open private room |
| POST | `/api/chat/send` | Send message through REST |
| GET | `/api/chat/history/{roomId}` | Get message history |
| DELETE | `/api/chat/history/{roomId}` | Delete message history |
| DELETE | `/api/chat/rooms/{roomId}` | Delete room |
| GET | `/api/messages` | Query messages |
| POST | `/api/chat/forward` | Forward message |
| POST | `/api/messages/recall` | Recall message |
| GET | `/api/chat/{roomId}/search` | Search messages in room |
| GET | `/api/messages/search` | Global message search |
| GET | `/api/chat/{roomId}/pins` | List pinned messages |
| PUT | `/api/chat/rooms/{roomId}/nickname` | Update room nickname |
| PUT | `/api/chat/rooms/{roomId}/wallpaper` | Update room wallpaper |
| GET | `/api/chat/{roomId}/unread-context` | Get unread context |

### Group

| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/group` | Create group |
| PUT | `/api/group` | Update group |
| DELETE | `/api/group/{groupId}` | Delete group |
| GET | `/api/group/{groupId}` | Get group detail |
| GET | `/api/group/my-groups` | List my groups |
| POST | `/api/group/members` | Add members |
| DELETE | `/api/group/members` | Remove members |
| PUT | `/api/group/members/role` | Update member role |
| POST | `/api/group/leave/{groupId}` | Leave group |
| POST | `/api/group/message` | Send group message |
| POST | `/api/group/read-receipt` | Mark group message as read |
| GET | `/api/group/{groupId}/events` | List group events |
| GET | `/api/group/{groupId}/settings` | Get group settings |
| PUT | `/api/group/settings` | Update group settings |
| POST | `/api/group/transfer-ownership` | Transfer ownership |
| POST | `/api/group/block-member` | Block group member |
| DELETE | `/api/group/{groupId}/block-member/{targetUserId}` | Unblock group member |
| GET | `/api/group/{groupId}/blocked` | List blocked group members |
| POST | `/api/group/join/{joinToken}` | Join by invite token |
| POST | `/api/group/{groupId}/refresh-link` | Refresh invite link |

### Social, Story, Poll, Media, Call, AI

| Area | Base Endpoint |
| --- | --- |
| Posts | `/api/posts` |
| Stories | `/api/stories` |
| Polls | `/api/polls` |
| Media pre-signed URL | `/api/media/presigned-url` |
| File upload | `/api/files/upload` |
| Link preview | `/api/link-preview` |
| Calls | `/api/call` |
| Analytics | `/api/analytics` |
| AI tools | `/api/chat/rooms/.../ai/*`, `/api/chat/rooms/persona-chat`, `/api/chat/rooms/translate`, `/api/chat/rooms/improve-text`, `/api/chat/rooms/speech-to-text` |

## WebSocket / STOMP

WebSocket endpoint:

```text
/ws
```

Broker prefixes:

```text
/topic
/queue
```

Application destination prefix:

```text
/app
```

Client sends messages to:

| Destination | Purpose |
| --- | --- |
| `/app/chat.send` | Send realtime chat message |
| `/app/chat.typing` | Send typing indicator |
| `/app/chat.read` | Send read receipt |
| `/app/chat.reaction` | Add/update reaction |
| `/app/chat.pin` | Pin message |

The STOMP `CONNECT` frame must include a valid JWT token in the `Authorization` header.

Example header:

```text
Authorization: Bearer <access_token>
```

## Testing

Run all tests:

```bash
./mvnw test
```

On Windows:

```powershell
.\mvnw.cmd test
```

Run one test class:

```bash
./mvnw test -Dtest=ChatControllerTest
```

## Build

Create a JAR:

```bash
./mvnw clean package
```

Build Docker image:

```bash
docker compose build minizalo-backend
```

## Troubleshooting

### Backend cannot connect to PostgreSQL

Check that Docker Compose is running and that `.env` contains the same database username/password used by `minizalo-db`.

```bash
docker compose ps
docker compose logs minizalo-db
```

### DynamoDB errors on startup

For local development, `AWS_DYNAMODB_ENDPOINT` should be:

```text
http://dynamodb-local:8000
```

When running outside Docker, use:

```text
http://localhost:8000
```

### MinIO upload or public URL fails

Check the bucket name and public URL:

```env
MINIO_BUCKET_NAME=minizalo-media
MINIO_PUBLIC_URL=http://localhost:9000
```

Open MinIO Console at:

```text
http://localhost:9001
```

### WebSocket connects but messages are not delivered

Verify:

- STOMP endpoint is `/ws`.
- Client sends to `/app/...` destinations.
- Client subscribes to `/topic/...` or `/queue/...` destinations used by the backend.
- JWT is included in the STOMP `CONNECT` frame.
- Browser origin is allowed by the backend CORS/WebSocket configuration.

### Gmail OTP does not send

Use a Gmail app password and verify:

```env
MAIL_USERNAME=your_gmail@gmail.com
MAIL_PASSWORD=your_gmail_app_password
```

## Notes for Production

- Replace all demo secrets in `.env`.
- Disable public MinIO bucket policy if files must be private.
- Use real AWS DynamoDB or a managed NoSQL database for production traffic.
- Use HTTPS and a reverse proxy for public deployment.
- Restrict WebSocket/CORS origins to trusted frontend domains.
- Store Firebase credentials and API keys as deployment secrets.

## License

Private educational project for IUH coursework.
