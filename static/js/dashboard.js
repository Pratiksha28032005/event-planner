const session = JSON.parse(localStorage.getItem("event-planner-session") || "null");

if (!session?.token) {
  window.location.href = "/";
}

const THEME_STORAGE_KEY = "event-planner-theme";
const LEGACY_THEME_STORAGE_KEY = "theme";
const themeButtons = document.querySelectorAll(".theme-button");
const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  || localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
  || "dark";

if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
const welcomeTitle = document.getElementById("welcome-title");
const rolePill = document.getElementById("role-pill");
const summaryGrid = document.getElementById("summary-grid");
const spotlightGrid = document.getElementById("spotlight-grid");
const eventsGrid = document.getElementById("events-grid");
const logoutButton = document.getElementById("logout-button");
const eventForm = document.getElementById("event-form");
const userSelect = document.getElementById("event-user");
const eventsCaption = document.getElementById("events-caption");
const pendingWorkersGrid = document.getElementById("pending-workers-grid");
const workerDirectoryGrid = document.getElementById("worker-directory-grid");
const pendingWorkerCount = document.getElementById("pending-worker-count");
const approvedWorkerCount = document.getElementById("approved-worker-count");
const workerRoleSelects = document.querySelectorAll(".worker-role-select");
const heroFocus = document.getElementById("hero-focus");
const heroDescription = document.getElementById("hero-description");
const heroEventCount = document.getElementById("hero-event-count");
const heroOpenCount = document.getElementById("hero-open-count");
const heroDeadline = document.getElementById("hero-deadline");
const marqueeLabel = document.getElementById("marquee-label");
const marqueeValue = document.getElementById("marquee-value");
const marqueeNote = document.getElementById("marquee-note");
const sectionNavButtons = document.querySelectorAll("[data-section-target]");
const dashboardSections = document.querySelectorAll(".dashboard-section");
const isManagerPage = window.location.pathname.endsWith("manager-dashboard.html");
const isUserPage = window.location.pathname.endsWith("user-dashboard.html");
const isWorkerPage = window.location.pathname.endsWith("worker-dashboard.html");
const canEditTasks = ["manager", "user"].includes(session.user.role);

let users = [];
let workers = [];
let events = [];
let workerRoles = [];

function redirectToRoleHome() {
  if (session.user.role === "manager") {
    window.location.href = "/manager-dashboard.html";
  } else if (session.user.role === "worker") {
    window.location.href = "/worker-dashboard.html";
  } else {
    window.location.href = "/user-dashboard.html";
  }
}

function activateSection(sectionName, updateHash = true) {
  if (!dashboardSections.length) {
    return;
  }

  const targetSection = Array.from(dashboardSections).find(
    (section) => section.dataset.section === sectionName
  );

  const fallbackSection = dashboardSections[0];
  const resolvedName = targetSection?.dataset.section || fallbackSection?.dataset.section;

  dashboardSections.forEach((section) => {
    section.classList.toggle("active", section.dataset.section === resolvedName);
  });

  sectionNavButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.sectionTarget === resolvedName);
    button.setAttribute("aria-pressed", String(button.dataset.sectionTarget === resolvedName));
  });

  if (updateHash && resolvedName) {
    history.replaceState(null, "", `#${resolvedName}`);
  }
}

if (isManagerPage && session.user.role !== "manager") {
  redirectToRoleHome();
}

if (isUserPage && session.user.role !== "user") {
  redirectToRoleHome();
}

if (isWorkerPage && session.user.role !== "worker") {
  redirectToRoleHome();
}

resetInitialScroll();
applyTheme(storedTheme);
bindThemeButtons();
document.body.dataset.role = session.user.role;
welcomeTitle.textContent = `Welcome, ${session.user.name}`;
rolePill.textContent = session.user.role === "worker"
  ? `${session.user.workerRole} Worker`
  : `${session.user.role.charAt(0).toUpperCase()}${session.user.role.slice(1)} Access`;

logoutButton.addEventListener("click", () => {
  localStorage.removeItem("event-planner-session");
  window.location.href = "/";
});

sectionNavButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateSection(button.dataset.sectionTarget);
  });
});

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysRemaining(dateString) {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(dateString));
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

function formatCountdown(days) {
  if (days < 0) {
    return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  }

  if (days === 0) {
    return "Today";
  }

  if (days === 1) {
    return "1 day left";
  }

  return `${days} days left`;
}

function formatDisplayDate(dateString) {
  if (!dateString) {
    return "Date pending";
  }

  const date = new Date(dateString);
  return Number.isNaN(date.getTime())
    ? dateString
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(date);
}

function getTaskProgress(event) {
  const totalTasks = event.tasks.length;
  const completedTasks = event.tasks.filter((task) => task.done).length;
  const percent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  return { totalTasks, completedTasks, percent };
}

function getBadge(event) {
  const remaining = daysRemaining(event.date);
  const progress = getTaskProgress(event);

  if (progress.totalTasks > 0 && progress.completedTasks === progress.totalTasks) {
    return { label: "Ready", className: "ready" };
  }

  if (remaining <= 7) {
    return { label: "Urgent", className: "urgent" };
  }

  return { label: formatCountdown(remaining), className: "pending" };
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;

  themeButtons.forEach((button) => {
    const isActive = button.dataset.theme === theme;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function bindThemeButtons() {
  themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const theme = button.dataset.theme;
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(LEGACY_THEME_STORAGE_KEY, theme);
      applyTheme(theme);
    });
  });
}

function resetInitialScroll() {
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
  });
}

async function readApiResponse(response, fallbackMessage) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      throw new Error(fallbackMessage);
    }
  }

  const text = (await response.text()).trim();
  const compactText = text.replace(/\s+/g, " ");
  const looksLikeHtml = compactText.toLowerCase().startsWith("<!doctype")
    || compactText.toLowerCase().startsWith("<html");

  if (looksLikeHtml) {
    throw new Error("The server returned an HTML page instead of JSON. Restart the Flask server and try again.");
  }

  throw new Error(compactText || fallbackMessage);
}

function countOpenTasks() {
  return events.reduce((count, event) => {
    const progress = getTaskProgress(event);
    return count + (progress.totalTasks - progress.completedTasks);
  }, 0);
}

function getOrderedEvents() {
  return [...events].sort((left, right) => new Date(left.date) - new Date(right.date));
}

function getNextEvent() {
  return getOrderedEvents().find((event) => daysRemaining(event.date) >= 0) || getOrderedEvents()[0] || null;
}

function getAverageProgress() {
  if (!events.length) {
    return 0;
  }

  const total = events.reduce((sum, event) => sum + getTaskProgress(event).percent, 0);
  return Math.round(total / events.length);
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "NA";
}

function buildSummaryCard(label, value, copy, chip, tone) {
  return `
    <article class="summary-card ${tone}">
      <div class="summary-top">
        <p>${label}</p>
        <span class="summary-chip">${chip}</span>
      </div>
      <strong>${value}</strong>
      <span>${copy}</span>
    </article>
  `;
}

function renderSummary() {
  const urgentEvents = events.filter((event) => {
    const progress = getTaskProgress(event);
    return progress.completedTasks !== progress.totalTasks && daysRemaining(event.date) <= 7;
  }).length;

  const readyEvents = events.filter((event) => {
    const progress = getTaskProgress(event);
    return progress.totalTasks > 0 && progress.completedTasks === progress.totalTasks;
  }).length;

  if (session.user.role === "manager") {
    const approvedWorkers = workers.filter((worker) => worker.status === "approved").length;
    const pendingWorkers = workers.filter((worker) => worker.status === "pending").length;

    summaryGrid.innerHTML = [
      buildSummaryCard("Total events", events.length, "Live event records flowing through the dashboard.", "Live board", "tone-cobalt"),
      buildSummaryCard("Approved workers", approvedWorkers, "Specialists ready for role-based assignments.", "Crew ready", "tone-gold"),
      buildSummaryCard("Pending approvals", pendingWorkers, "Registration requests still waiting for review.", "Needs review", "tone-coral"),
      buildSummaryCard("Open tasks", countOpenTasks(), "Checklist items still active across the calendar.", "Task flow", "tone-mint")
    ].join("");
    return;
  }

  if (session.user.role === "worker") {
    summaryGrid.innerHTML = [
      buildSummaryCard("Your role", session.user.workerRole, "Your approved specialty across assigned events.", "Specialty", "tone-cobalt"),
      buildSummaryCard("Assigned events", events.length, "Events currently connected to your worker account.", "Active board", "tone-gold"),
      buildSummaryCard("Urgent events", urgentEvents, "Assignments happening within the next 7 days.", "Fast lane", "tone-coral"),
      buildSummaryCard("Ready events", readyEvents, "Events whose checklist is already fully complete.", "Ready", "tone-mint")
    ].join("");
    return;
  }

  summaryGrid.innerHTML = [
    buildSummaryCard("Assigned events", events.length, "Events currently linked to your account.", "On deck", "tone-cobalt"),
    buildSummaryCard("Urgent events", urgentEvents, "Upcoming celebrations inside the 7-day window.", "Attention", "tone-coral"),
    buildSummaryCard("Ready events", readyEvents, "Events where every checklist item is complete.", "Polished", "tone-mint"),
    buildSummaryCard("Open tasks", countOpenTasks(), "Checklist items still waiting on completion.", "In motion", "tone-gold")
  ].join("");
}

function renderHero() {
  const nextEvent = getNextEvent();
  const openTasks = countOpenTasks();

  if (heroEventCount) {
    heroEventCount.textContent = String(events.length);
  }

  if (heroOpenCount) {
    heroOpenCount.textContent = String(openTasks);
  }

  if (heroDeadline) {
    heroDeadline.textContent = nextEvent ? formatCountdown(daysRemaining(nextEvent.date)) : "Queue clear";
  }

  if (session.user.role === "manager") {
    if (heroFocus) {
      heroFocus.textContent = nextEvent
        ? `${nextEvent.name} is the next headline moment.`
        : "Start building a richer event runway.";
    }
    if (heroDescription) {
      heroDescription.textContent = nextEvent
        ? `The nearest event lands on ${formatDisplayDate(nextEvent.date)} at ${nextEvent.venue}. Use this board to keep every moving part aligned.`
        : "Create your first event, approve workers, and turn this board into your all-in-one production hub.";
    }
    if (marqueeLabel) {
      marqueeLabel.textContent = "Live pulse";
    }
    if (marqueeValue) {
      marqueeValue.textContent = nextEvent ? nextEvent.name : "Event flow ready";
    }
    if (marqueeNote) {
      const pendingWorkers = workers.filter((worker) => worker.status === "pending").length;
      marqueeNote.textContent = pendingWorkers
        ? `${pendingWorkers} worker request${pendingWorkers === 1 ? "" : "s"} waiting for review.`
        : "No worker bottlenecks right now.";
    }
    return;
  }

  if (session.user.role === "worker") {
    if (heroFocus) {
      heroFocus.textContent = nextEvent
        ? `${nextEvent.name} is your next assignment focus.`
        : "Your specialist board is ready for the next assignment.";
    }
    if (heroDescription) {
      heroDescription.textContent = nextEvent
        ? `You are lined up for ${formatDisplayDate(nextEvent.date)} at ${nextEvent.venue}. Track readiness and stay aligned with the event owner.`
        : "Once a manager assigns your specialty to an event, the full production snapshot will appear here.";
    }
    if (marqueeLabel) {
      marqueeLabel.textContent = "Role focus";
    }
    if (marqueeValue) {
      marqueeValue.textContent = session.user.workerRole;
    }
    if (marqueeNote) {
      marqueeNote.textContent = nextEvent
        ? `${nextEvent.workerAssignments.length} role assignment${nextEvent.workerAssignments.length === 1 ? "" : "s"} are linked to your next event.`
        : "No assignments connected yet.";
    }
    return;
  }

  if (heroFocus) {
    heroFocus.textContent = nextEvent
      ? `${nextEvent.name} is the next celebration on your calendar.`
      : "Your event dashboard is ready for assignments.";
  }
  if (heroDescription) {
    heroDescription.textContent = nextEvent
      ? `The next milestone arrives on ${formatDisplayDate(nextEvent.date)} at ${nextEvent.venue}. Track every checklist item and support role from one place.`
      : "When a manager assigns an event to you, the full countdown and task board will appear here.";
  }
  if (marqueeLabel) {
    marqueeLabel.textContent = "Next moment";
  }
  if (marqueeValue) {
    marqueeValue.textContent = nextEvent ? nextEvent.name : "Timeline clear";
  }
  if (marqueeNote) {
    marqueeNote.textContent = nextEvent
      ? `${nextEvent.workerAssignments.length} worker role${nextEvent.workerAssignments.length === 1 ? "" : "s"} connected to your next event.`
      : "No assigned events yet.";
  }
}

function renderSpotlights() {
  if (!spotlightGrid) {
    return;
  }

  const nextEvent = getNextEvent();
  const totalAssignments = events.reduce((count, event) => count + (event.workerAssignments?.length || 0), 0);
  const approvedWorkers = workers.filter((worker) => worker.status === "approved").length;
  let cards = [];

  if (session.user.role === "manager") {
    cards = [
      {
        tone: "tone-cobalt",
        label: "Upcoming pulse",
        title: nextEvent ? nextEvent.name : "No upcoming event yet",
        copy: nextEvent
          ? `${formatDisplayDate(nextEvent.date)} at ${nextEvent.venue}`
          : "Create an event to start your dashboard timeline."
      },
      {
        tone: "tone-gold",
        label: "Crew coverage",
        title: `${approvedWorkers} approved specialist${approvedWorkers === 1 ? "" : "s"}`,
        copy: `${workers.filter((worker) => worker.status === "pending").length} pending approval request${workers.filter((worker) => worker.status === "pending").length === 1 ? "" : "s"}.`
      },
      {
        tone: "tone-mint",
        label: "Readiness arc",
        title: `${getAverageProgress()}% average completion`,
        copy: `${countOpenTasks()} open checklist item${countOpenTasks() === 1 ? "" : "s"} still in motion.`
      }
    ];
  } else if (session.user.role === "worker") {
    cards = [
      {
        tone: "tone-cobalt",
        label: "Signature role",
        title: session.user.workerRole,
        copy: "Your approved specialty and entry point into the event flow."
      },
      {
        tone: "tone-coral",
        label: "Next assignment",
        title: nextEvent ? nextEvent.name : "Waiting for assignment",
        copy: nextEvent
          ? `${formatDisplayDate(nextEvent.date)} at ${nextEvent.venue}`
          : "A manager can attach your role to an event when needed."
      },
      {
        tone: "tone-gold",
        label: "Shared crew",
        title: `${totalAssignments} linked role${totalAssignments === 1 ? "" : "s"}`,
        copy: "See which other specialists are supporting the same events."
      }
    ];
  } else {
    cards = [
      {
        tone: "tone-cobalt",
        label: "Next celebration",
        title: nextEvent ? nextEvent.name : "Nothing assigned yet",
        copy: nextEvent
          ? `${formatDisplayDate(nextEvent.date)} at ${nextEvent.venue}`
          : "Your assigned events will show up here as soon as they are linked."
      },
      {
        tone: "tone-gold",
        label: "Checklist rhythm",
        title: `${getAverageProgress()}% average completion`,
        copy: `${countOpenTasks()} open task${countOpenTasks() === 1 ? "" : "s"} are still active across your events.`
      },
      {
        tone: "tone-mint",
        label: "Support crew",
        title: `${totalAssignments} worker role${totalAssignments === 1 ? "" : "s"}`,
        copy: "Track the specialists helping deliver each event experience."
      }
    ];
  }

  spotlightGrid.innerHTML = cards.map((card) => `
    <article class="spotlight-card ${card.tone}">
      <span class="spotlight-label">${card.label}</span>
      <h3>${card.title}</h3>
      <p>${card.copy}</p>
    </article>
  `).join("");
}

function getEventCardClass(event) {
  const badge = getBadge(event);
  return `event-card ${badge.className}`;
}

function renderAssignmentBlock(event) {
  if (!event.workerAssignments?.length) {
    return `
      <div class="assignment-block">
        <div class="assignment-header">
          <strong>Worker assignments</strong>
          <span>No workers assigned yet</span>
        </div>
      </div>
    `;
  }

  const assignmentItems = event.workerAssignments.map((assignment) => {
    const isCurrentWorker = session.user.role === "worker" && assignment.workerId === session.user.id;
    return `
      <div class="assignment-chip ${isCurrentWorker ? "current" : ""}">
        <div>
          <strong>${assignment.role}</strong>
          <span>${assignment.workerName}</span>
        </div>
        <small>${assignment.workerStatus}</small>
      </div>
    `;
  }).join("");

  return `
    <div class="assignment-block">
      <div class="assignment-header">
        <strong>Worker assignments</strong>
        <span>${event.workerAssignments.length} role${event.workerAssignments.length === 1 ? "" : "s"} linked</span>
      </div>
      <div class="assignment-list">
        ${assignmentItems}
      </div>
    </div>
  `;
}

function renderTaskList(event) {
  return event.tasks.map((task) => {
    if (canEditTasks) {
      return `
        <div class="task-item ${task.done ? "done" : ""}">
          <span>${task.title}</span>
          <button
            class="task-button ${task.done ? "done" : ""}"
            type="button"
            data-event-id="${event.id}"
            data-task-id="${task.id}"
          >
            ${task.done ? "Completed" : "Mark done"}
          </button>
        </div>
      `;
    }

    return `
      <div class="task-item ${task.done ? "done" : ""}">
        <span>${task.title}</span>
        <span class="task-state">${task.done ? "Completed" : "In progress"}</span>
      </div>
    `;
  }).join("");
}

function renderEvents() {
  if (!events.length) {
    const emptyCopy = session.user.role === "worker"
      ? "No worker assignments found yet. A manager can assign you after approval."
      : "No events found for this account yet.";
    eventsGrid.innerHTML = `<div class="empty-state">${emptyCopy}</div>`;
    return;
  }

  const orderedEvents = getOrderedEvents();

  eventsGrid.innerHTML = orderedEvents.map((event) => {
    const badge = getBadge(event);
    const countdown = daysRemaining(event.date);
    const progress = getTaskProgress(event);
    const ownerLabel = session.user.role === "worker" ? "Assigned User" : "User";

    return `
      <article class="${getEventCardClass(event)}">
        <div class="card-top">
          <div class="event-headline">
            <span class="event-chip">Event board</span>
            <h3>${event.name}</h3>
            <p class="event-id">${event.id}</p>
          </div>
          <span class="badge ${badge.className}">${badge.label}</span>
        </div>

        <div class="event-meta-grid">
          <div class="meta-tile">
            <span>Date</span>
            <strong>${formatDisplayDate(event.date)}</strong>
          </div>
          <div class="meta-tile">
            <span>Venue</span>
            <strong>${event.venue}</strong>
          </div>
          <div class="meta-tile">
            <span>Countdown</span>
            <strong>${formatCountdown(countdown)}</strong>
          </div>
          <div class="meta-tile">
            <span>${ownerLabel}</span>
            <strong>${event.assignedUserName || "Unassigned"}</strong>
          </div>
        </div>

        ${renderAssignmentBlock(event)}

        <div class="progress-block">
          <div class="progress-copy">
            <strong>Checklist progress</strong>
            <span>${progress.completedTasks}/${progress.totalTasks} done</span>
          </div>
          <div class="progress-bar" aria-hidden="true">
            <span style="width: ${progress.percent}%;"></span>
          </div>
        </div>

        <div class="task-list">
          ${renderTaskList(event)}
        </div>
      </article>
    `;
  }).join("");

  if (!canEditTasks) {
    return;
  }

  document.querySelectorAll(".task-button").forEach((button) => {
    button.addEventListener("click", async () => {
      const eventId = button.dataset.eventId;
      const taskId = button.dataset.taskId;

      try {
        const response = await fetch(`/api/events/${eventId}/tasks/${taskId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${session.token}`
          }
        });

        const result = await readApiResponse(response, "Unable to update task.");

        if (!response.ok) {
          throw new Error(result.message || "Unable to update task.");
        }

        await loadData();
      } catch (error) {
        window.alert(error.message);
      }
    });
  });
}

function renderUserOptions() {
  if (!userSelect) {
    return;
  }

  const options = users
    .filter((user) => user.role === "user")
    .map((user) => `<option value="${user.id}">${user.name} (${user.email})</option>`)
    .join("");

  userSelect.innerHTML = options || '<option value="">No users available</option>';
}

function renderWorkerRoleOptions() {
  if (!workerRoleSelects.length) {
    return;
  }

  workerRoleSelects.forEach((select) => {
    const roleName = select.dataset.workerRole;
    const matchingWorkers = workers.filter((worker) => (
      worker.status === "approved" && worker.workerRole === roleName
    ));

    const options = matchingWorkers.map((worker) => (
      `<option value="${worker.id}">${worker.name} (${worker.email})</option>`
    )).join("");

    select.innerHTML = `<option value="">No worker selected</option>${options}`;
  });
}

function getStatusClass(status) {
  if (status === "approved") {
    return "approved";
  }

  if (status === "rejected") {
    return "rejected";
  }

  return "pending";
}

function formatStatus(status) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
}

function renderWorkers() {
  if (!pendingWorkersGrid || !workerDirectoryGrid) {
    return;
  }

  const pendingWorkers = workers.filter((worker) => worker.status === "pending");
  const approvedWorkers = workers.filter((worker) => worker.status === "approved");

  pendingWorkerCount.textContent = `${pendingWorkers.length} pending`;
  approvedWorkerCount.textContent = `${approvedWorkers.length} approved`;

  pendingWorkersGrid.innerHTML = pendingWorkers.length
    ? pendingWorkers.map((worker) => `
        <article class="worker-card">
          <div class="worker-card-top">
            <div class="worker-identity">
              <div class="worker-avatar">${getInitials(worker.name)}</div>
              <div>
                <h3>${worker.name}</h3>
                <p>${worker.workerRole}</p>
              </div>
            </div>
            <span class="status-badge ${getStatusClass(worker.status)}">${formatStatus(worker.status)}</span>
          </div>
          <div class="worker-details">
            <p><strong>Email</strong><span>${worker.email}</span></p>
            <p><strong>Specialty</strong><span>${worker.workerRole}</span></p>
          </div>
          <div class="worker-actions">
            <button class="approve-button" type="button" data-worker-action="approve" data-worker-id="${worker.id}">Approve</button>
            <button class="reject-button" type="button" data-worker-action="reject" data-worker-id="${worker.id}">Reject</button>
          </div>
        </article>
      `).join("")
    : '<div class="empty-state">No pending worker requests right now.</div>';

  workerDirectoryGrid.innerHTML = workers.length
    ? workers.map((worker) => `
        <article class="worker-card">
          <div class="worker-card-top">
            <div class="worker-identity">
              <div class="worker-avatar">${getInitials(worker.name)}</div>
              <div>
                <h3>${worker.name}</h3>
                <p>${worker.workerRole}</p>
              </div>
            </div>
            <span class="status-badge ${getStatusClass(worker.status)}">${formatStatus(worker.status)}</span>
          </div>
          <div class="worker-details">
            <p><strong>Email</strong><span>${worker.email}</span></p>
            <p><strong>Role</strong><span>${worker.workerRole}</span></p>
          </div>
        </article>
      `).join("")
    : '<div class="empty-state">No worker registrations found yet.</div>';

  document.querySelectorAll("[data-worker-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.workerAction;
      const workerId = button.dataset.workerId;
      const originalText = button.textContent;

      button.disabled = true;
      button.textContent = action === "approve" ? "Approving..." : "Rejecting...";

      try {
        const response = await fetch(`/api/workers/${workerId}/${action}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.token}`
          }
        });

        const result = await readApiResponse(response, "Unable to update worker.");

        if (!response.ok) {
          throw new Error(result.message || "Unable to update worker.");
        }

        await loadData();
      } catch (error) {
        window.alert(error.message);
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });
}

async function loadData() {
  const response = await fetch("/api/dashboard-data", {
    headers: {
      Authorization: `Bearer ${session.token}`
    }
  });

  if (response.status === 401) {
    localStorage.removeItem("event-planner-session");
    window.location.href = "/";
    return;
  }

  const result = await readApiResponse(response, "Unable to load dashboard data.");

  users = result.users || [];
  workers = result.workers || [];
  events = result.events || [];
  workerRoles = result.workerRoles || [];

  renderHero();
  renderSpotlights();
  renderSummary();
  renderEvents();

  if (session.user.role === "manager") {
    renderUserOptions();
    renderWorkerRoleOptions();
    renderWorkers();

    if (eventsCaption) {
      eventsCaption.textContent = "Managers can create events, assign users, match approved workers, and update any checklist item.";
    }
  } else if (session.user.role === "worker") {
    if (eventsCaption) {
      eventsCaption.textContent = "Workers can review assigned events, see their role placement, and follow checklist readiness.";
    }
  } else if (eventsCaption) {
    eventsCaption.textContent = "Users can track assigned events, watch the countdown, and update checklist progress.";
  }
}

if (eventForm) {
  eventForm.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();

    const formData = new FormData(eventForm);
    const workerAssignments = Array.from(workerRoleSelects)
      .map((select) => ({
        role: select.dataset.workerRole,
        workerId: select.value || ""
      }))
      .filter((assignment) => assignment.workerId);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      date: formData.get("date"),
      venue: String(formData.get("venue") || "").trim(),
      assignedUserId: formData.get("userId"),
      tasks: String(formData.get("tasks") || "")
        .split(/\r?\n|,/)
        .map((task) => task.trim())
        .filter(Boolean),
      workerAssignments
    };

    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify(payload)
      });

      const result = await readApiResponse(response, "Unable to create event.");

      if (!response.ok) {
        throw new Error(result.message || "Unable to create event.");
      }

      eventForm.reset();
      await loadData();
      activateSection("events");
    } catch (error) {
      window.alert(error.message);
    }
  });
}

activateSection(window.location.hash.replace("#", "") || "overview", false);

loadData().catch(() => {
  localStorage.removeItem("event-planner-session");
  window.location.href = "/";
});
