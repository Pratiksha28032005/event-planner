from __future__ import annotations

import json
import secrets
from pathlib import Path

from flask import Flask, jsonify, redirect, render_template, request


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
USERS_FILE = DATA_DIR / "users.json"
EVENTS_FILE = DATA_DIR / "events.json"
WORKERS_FILE = DATA_DIR / "workers.json"
WORKER_ROLES = [
    "Decorator",
    "Food Vendor",
    "Game Organizer",
    "Seating Manager",
    "Lighting Technician",
]

app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
sessions: dict[str, dict] = {}


def ensure_json_file(file_path: Path, default_data: dict) -> None:
    if not file_path.exists():
        with file_path.open("w", encoding="utf-8") as file:
            json.dump(default_data, file, indent=2)


def read_json(file_path: Path) -> dict:
    with file_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(file_path: Path, data: dict) -> None:
    with file_path.open("w", encoding="utf-8") as file:
        json.dump(data, file, indent=2)


def initialize_storage() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ensure_json_file(USERS_FILE, {"users": []})
    ensure_json_file(EVENTS_FILE, {"events": []})
    ensure_json_file(WORKERS_FILE, {"workers": []})


def load_users() -> dict:
    return read_json(USERS_FILE)


def load_events() -> dict:
    return read_json(EVENTS_FILE)


def load_workers() -> dict:
    return read_json(WORKERS_FILE)


def save_users(data: dict) -> None:
    write_json(USERS_FILE, data)


def save_events(data: dict) -> None:
    write_json(EVENTS_FILE, data)


def save_workers(data: dict) -> None:
    write_json(WORKERS_FILE, data)


def sanitize_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
    }


def sanitize_worker(worker: dict) -> dict:
    return {
        "id": worker["id"],
        "name": worker["name"],
        "email": worker["email"],
        "role": "worker",
        "workerRole": worker["role"],
        "status": worker["status"],
    }


def normalize_email(raw_email: str | None) -> str:
    return (raw_email or "").strip().lower()


def create_incremental_id(items: list[dict], prefix: str, start: int) -> str:
    highest_number = max(
        (
            int(str(item.get("id", "")).split("-")[-1])
            for item in items
            if str(item.get("id", "")).startswith(f"{prefix}-")
        ),
        default=start - 1,
    )
    return f"{prefix}-{highest_number + 1}"


def get_session_user() -> dict | None:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    return sessions.get(token)


def email_exists(users_data: dict, workers_data: dict, email: str) -> bool:
    return any(user["email"] == email for user in users_data["users"]) or any(
        worker["email"] == email for worker in workers_data["workers"]
    )


def find_user(users_data: dict, user_id: str) -> dict | None:
    return next((user for user in users_data["users"] if user["id"] == user_id), None)


def find_worker(workers_data: dict, worker_id: str) -> dict | None:
    return next((worker for worker in workers_data["workers"] if worker["id"] == worker_id), None)


def enrich_worker_assignments(event: dict, workers_data: dict) -> list[dict]:
    assignments = []

    for assignment in event.get("workerAssignments", []):
        worker = find_worker(workers_data, assignment.get("workerId", ""))
        assignments.append(
            {
                "id": assignment.get("id", assignment.get("workerId", "")),
                "role": assignment.get("role", ""),
                "workerId": assignment.get("workerId", ""),
                "workerName": worker["name"] if worker else "Unavailable",
                "workerEmail": worker["email"] if worker else "",
                "workerRole": worker["role"] if worker else assignment.get("role", ""),
                "workerStatus": worker["status"] if worker else "unknown",
            }
        )

    return assignments


def enrich_event(event: dict, users_data: dict, workers_data: dict) -> dict:
    assigned_user = find_user(users_data, event.get("assignedUserId", ""))

    return {
        "id": event["id"],
        "name": (event.get("name") or "").strip(),
        "date": event.get("date", ""),
        "venue": (event.get("venue") or "").strip(),
        "assignedUserId": event.get("assignedUserId", ""),
        "assignedUserName": assigned_user["name"] if assigned_user else "Unassigned",
        "tasks": [
            {
                "id": task["id"],
                "title": (task.get("title") or "").strip(),
                "done": bool(task.get("done")),
            }
            for task in event.get("tasks", [])
        ],
        "workerAssignments": enrich_worker_assignments(event, workers_data),
    }


def get_visible_events(session_user: dict, users_data: dict, events_data: dict, workers_data: dict) -> list[dict]:
    if session_user["role"] == "manager":
        source_events = events_data["events"]
    elif session_user["role"] == "user":
        source_events = [
            event for event in events_data["events"] if event.get("assignedUserId") == session_user["id"]
        ]
    else:
        source_events = [
            event
            for event in events_data["events"]
            if any(
                assignment.get("workerId") == session_user["id"]
                for assignment in event.get("workerAssignments", [])
            )
        ]

    return [enrich_event(event, users_data, workers_data) for event in source_events]


@app.post("/api/login")
def login() -> tuple:
    body = request.get_json(silent=True) or {}
    role = (body.get("role") or "").strip().lower()
    email = normalize_email(body.get("email"))
    password = body.get("password") or ""
    users_data = load_users()
    workers_data = load_workers()

    if role == "worker":
        worker = next(
            (
                entry
                for entry in workers_data["workers"]
                if entry["email"] == email and entry["password"] == password
            ),
            None,
        )

        if not worker:
            return jsonify({"message": "Invalid worker credentials."}), 401

        if worker["status"] == "pending":
            return jsonify({"message": "Waiting for approval"}), 403

        if worker["status"] == "rejected":
            return jsonify({"message": "Registration was rejected. Please contact the manager."}), 403

        auth_user = sanitize_worker(worker)
    else:
        user = next(
            (
                entry
                for entry in users_data["users"]
                if entry["role"] == role
                and entry["email"] == email
                and entry["password"] == password
                and (
                    entry.get("code") == (body.get("code") or "").strip()
                    if role == "manager"
                    else (body.get("eventId") or "").strip() in entry.get("eventIds", [])
                )
            ),
            None,
        )

        if not user:
            return jsonify({"message": "Invalid credentials for this role."}), 401

        auth_user = sanitize_user(user)

    token = secrets.token_urlsafe(32)
    sessions[token] = auth_user
    return jsonify({"token": token, "user": auth_user}), 200


@app.post("/api/register")
def register() -> tuple:
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = normalize_email(body.get("email"))
    password = (body.get("password") or "").strip()

    if not name or not email or not password:
        return jsonify({"message": "Please fill in all registration fields."}), 400

    users_data = load_users()
    workers_data = load_workers()

    if email_exists(users_data, workers_data, email):
        return jsonify({"message": "This email is already registered."}), 409

    new_user = {
        "id": create_incremental_id(users_data["users"], "USR", 1),
        "name": name,
        "email": email,
        "password": password,
        "role": "user",
        "eventIds": [],
    }

    users_data["users"].append(new_user)
    save_users(users_data)

    return jsonify({"message": "Account created successfully.", "user": sanitize_user(new_user)}), 201


@app.post("/api/workers/register")
def register_worker() -> tuple:
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    email = normalize_email(body.get("email"))
    password = (body.get("password") or "").strip()
    worker_role = (body.get("role") or "").strip()

    if not name or not email or not password or not worker_role:
        return jsonify({"message": "Please complete the worker registration form."}), 400

    if worker_role not in WORKER_ROLES:
        return jsonify({"message": "Please choose a valid worker role."}), 400

    users_data = load_users()
    workers_data = load_workers()

    if email_exists(users_data, workers_data, email):
        return jsonify({"message": "This email is already registered."}), 409

    new_worker = {
        "id": create_incremental_id(workers_data["workers"], "WRK", 1),
        "name": name,
        "email": email,
        "password": password,
        "role": worker_role,
        "status": "pending",
    }

    workers_data["workers"].append(new_worker)
    save_workers(workers_data)

    return jsonify(
        {
            "message": "Worker registration submitted. Waiting for manager approval.",
            "worker": sanitize_worker(new_worker),
        }
    ), 201


@app.get("/api/workers")
def list_workers() -> tuple:
    session_user = get_session_user()

    if not session_user or session_user["role"] != "manager":
        return jsonify({"message": "Only managers can view workers."}), 403

    workers_data = load_workers()
    workers = [sanitize_worker(worker) for worker in workers_data["workers"]]
    return jsonify({"workers": workers}), 200


@app.get("/api/workers/pending")
def list_pending_workers() -> tuple:
    session_user = get_session_user()

    if not session_user or session_user["role"] != "manager":
        return jsonify({"message": "Only managers can view pending workers."}), 403

    workers_data = load_workers()
    workers = [
        sanitize_worker(worker)
        for worker in workers_data["workers"]
        if worker["status"] == "pending"
    ]
    return jsonify({"workers": workers}), 200


def update_worker_status(worker_id: str, status: str) -> tuple:
    session_user = get_session_user()

    if not session_user or session_user["role"] != "manager":
        return jsonify({"message": "Only managers can update worker status."}), 403

    workers_data = load_workers()
    worker = find_worker(workers_data, worker_id)

    if not worker:
        return jsonify({"message": "Worker not found."}), 404

    worker["status"] = status
    save_workers(workers_data)

    if status == "rejected":
        events_data = load_events()
        for event in events_data["events"]:
            event["workerAssignments"] = [
                assignment
                for assignment in event.get("workerAssignments", [])
                if assignment.get("workerId") != worker_id
            ]
        save_events(events_data)

    return jsonify(
        {
            "message": f"Worker {status} successfully.",
            "worker": sanitize_worker(worker),
        }
    ), 200


@app.post("/api/workers/<worker_id>/approve")
def approve_worker(worker_id: str) -> tuple:
    return update_worker_status(worker_id, "approved")


@app.post("/api/workers/<worker_id>/reject")
def reject_worker(worker_id: str) -> tuple:
    return update_worker_status(worker_id, "rejected")


@app.get("/api/dashboard-data")
def dashboard_data() -> tuple:
    session_user = get_session_user()

    if not session_user:
        return jsonify({"message": "Session expired. Please log in again."}), 401

    users_data = load_users()
    events_data = load_events()
    workers_data = load_workers()

    return jsonify(
        {
            "account": session_user,
            "workerRoles": WORKER_ROLES,
            "users": [sanitize_user(user) for user in users_data["users"]],
            "workers": (
                [sanitize_worker(worker) for worker in workers_data["workers"]]
                if session_user["role"] == "manager"
                else []
            ),
            "pendingWorkers": (
                [
                    sanitize_worker(worker)
                    for worker in workers_data["workers"]
                    if worker["status"] == "pending"
                ]
                if session_user["role"] == "manager"
                else []
            ),
            "events": get_visible_events(session_user, users_data, events_data, workers_data),
        }
    ), 200


@app.post("/api/events")
def create_event() -> tuple:
    session_user = get_session_user()

    if not session_user or session_user["role"] != "manager":
        return jsonify({"message": "Only managers can create events."}), 403

    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    event_date = (body.get("date") or "").strip()
    venue = (body.get("venue") or "").strip()
    assigned_user_id = (body.get("assignedUserId") or "").strip()
    raw_tasks = body.get("tasks")
    raw_assignments = body.get("workerAssignments")

    tasks = [str(task).strip() for task in raw_tasks] if isinstance(raw_tasks, list) else []
    tasks = [task for task in tasks if task]
    worker_assignments = raw_assignments if isinstance(raw_assignments, list) else []

    if not name or not event_date or not venue or not assigned_user_id or not tasks:
        return jsonify({"message": "Please provide complete event details."}), 400

    users_data = load_users()
    events_data = load_events()
    workers_data = load_workers()
    assigned_user = next(
        (
            user
            for user in users_data["users"]
            if user["id"] == assigned_user_id and user["role"] == "user"
        ),
        None,
    )

    if not assigned_user:
        return jsonify({"message": "Please choose a valid user for this event."}), 400

    validated_assignments = []
    seen_roles: set[str] = set()

    for assignment in worker_assignments:
        assignment_role = str(assignment.get("role") or "").strip()
        worker_id = str(assignment.get("workerId") or "").strip()

        if not assignment_role or not worker_id:
            continue

        if assignment_role not in WORKER_ROLES or assignment_role in seen_roles:
            return jsonify({"message": "Worker assignments must use unique valid roles."}), 400

        worker = find_worker(workers_data, worker_id)
        if not worker or worker["status"] != "approved" or worker["role"] != assignment_role:
            return jsonify({"message": "Please choose approved workers that match each role."}), 400

        seen_roles.add(assignment_role)
        validated_assignments.append(
            {
                "id": f"{worker_id}-{assignment_role.lower().replace(' ', '-')}",
                "role": assignment_role,
                "workerId": worker_id,
            }
        )

    event_id = create_incremental_id(events_data["events"], "EVT", 101)
    event_record = {
        "id": event_id,
        "name": name,
        "date": event_date,
        "venue": venue,
        "assignedUserId": assigned_user_id,
        "tasks": [
            {"id": f"{event_id}-TASK-{index + 1}", "title": task, "done": False}
            for index, task in enumerate(tasks)
        ],
        "workerAssignments": validated_assignments,
    }

    events_data["events"].append(event_record)
    save_events(events_data)

    assigned_user.setdefault("eventIds", [])
    if event_id not in assigned_user["eventIds"]:
        assigned_user["eventIds"].append(event_id)
        save_users(users_data)

    return jsonify(
        {
            "message": "Event created successfully.",
            "event": enrich_event(event_record, users_data, workers_data),
        }
    ), 201


@app.patch("/api/events/<event_id>/tasks/<task_id>")
def update_task(event_id: str, task_id: str) -> tuple:
    session_user = get_session_user()

    if not session_user:
        return jsonify({"message": "Session expired. Please log in again."}), 401

    if session_user["role"] == "worker":
        return jsonify({"message": "Workers can only view their assignments."}), 403

    events_data = load_events()
    event_record = next((event for event in events_data["events"] if event["id"] == event_id), None)

    if not event_record:
        return jsonify({"message": "Event not found."}), 404

    if session_user["role"] != "manager" and event_record["assignedUserId"] != session_user["id"]:
        return jsonify({"message": "You cannot edit tasks for this event."}), 403

    task = next((entry for entry in event_record["tasks"] if entry["id"] == task_id), None)

    if not task:
        return jsonify({"message": "Task not found."}), 404

    task["done"] = not task["done"]
    save_events(events_data)

    return jsonify({"message": "Task updated.", "task": task}), 200


@app.get("/")
def index() -> object:
    return render_template("index.html", worker_roles=WORKER_ROLES)


@app.get("/index.html")
def index_alias() -> object:
    return render_template("index.html", worker_roles=WORKER_ROLES)


@app.get("/manager-dashboard.html")
def manager_dashboard() -> object:
    return render_template("manager-dashboard.html", worker_roles=WORKER_ROLES)


@app.get("/user-dashboard.html")
def user_dashboard() -> object:
    return render_template("user-dashboard.html")


@app.get("/worker-dashboard.html")
def worker_dashboard() -> object:
    return render_template("worker-dashboard.html")


@app.get("/dashboard.html")
def dashboard_alias() -> object:
    return redirect("/")


initialize_storage()


if __name__ == "__main__":
    app.run(debug=False, port=3000)
