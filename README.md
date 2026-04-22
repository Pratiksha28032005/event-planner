# Event Planning Project

This is a small full-stack event planning app with:

- `Manager` login
- `User` login
- `User` registration
- `Worker` registration and approval
- JSON-based backend storage
- Event dashboard with countdown, urgent badge, and ready status
- Separate manager, user, and worker dashboards
- Flask `templates/` and `static/` structure

## Run

```powershell
python -m pip install -r requirements.txt
python app.py
```

Then open:

```text
http://localhost:3000
```

## Demo Logins

Manager:

- Email: `manager@event.com`
- Password: `Manager@123`
- Manager Code: `MGR-2026`

User:

- Email: `user@event.com`
- Password: `User@123`
- Event ID: `EVT-101`

Registered users:

- Can sign up from the `Register` tab on the home page
- After registration, a manager can assign events to them

Workers:

- Can sign up from the `Worker` registration tab
- Default status is `pending`
- Managers can approve or reject them from the manager dashboard
- Only approved workers can log in

## JSON Schema

`data/users.json`

```json
{
  "users": [
    {
      "id": "USR-1",
      "name": "Aman Verma",
      "email": "user@event.com",
      "password": "User@123",
      "role": "user",
      "eventIds": ["EVT-101"]
    }
  ]
}
```

`data/workers.json`

```json
{
  "workers": [
    {
      "id": "WRK-1",
      "name": "Anita",
      "email": "anita@example.com",
      "password": "Worker@123",
      "role": "Decorator",
      "status": "pending"
    }
  ]
}
```

`data/events.json`

```json
{
  "events": [
    {
      "id": "EVT-101",
      "name": "Annual Day",
      "date": "2026-04-24",
      "venue": "Hall A",
      "assignedUserId": "USR-1",
      "tasks": [],
      "workerAssignments": [
        {
          "id": "WRK-1-decorator",
          "role": "Decorator",
          "workerId": "WRK-1"
        }
      ]
    }
  ]
}
```

## Files

- `app.py`: Flask backend server and API
- `templates/`: Flask HTML templates
- `static/css/`: CSS files
- `static/js/`: JavaScript files
- `data/users.json`: login accounts
- `data/events.json`: event data
- `data/workers.json`: worker registrations and approval status
