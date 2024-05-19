import {
  LitElement,
  html,
  css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

class DailyGrapherCard extends LitElement {
  static get properties() {
    return {
        _hass: {},
        _config: {},
        currentTime: {},
        date: {},
        data: {},
    }
  };

  getDates() {
    let today = new Date();
    let tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    today = today.toLocaleDateString("sv-SE"); // only need the day
    tomorrow = tomorrow.toLocaleDateString("sv-SE"); // only need the day
    return { today, tomorrow };
  }

  setConfig(config) {
    if (!config.entities) {
      throw new Error("You need to define entities");
    }
    this._config = config;
    this.date = this.getDates();
    this.currentTime = new Date();
    this.interval = window.setInterval(() => {
      this.currentTime = new Date();
    }, 10000);
  }

  set hass(hass) {
    this._hass = hass;
    if (this.data) return null;
    this.getCalendarEvents();
  }

  getCardSize() {
    return 2;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.interval);
  }

  async getCalendarEvents() {
    if (!this._hass) {
      return null;
    }

    const allEvents = [];
    const promises = [];

    // Retrieve activies from all calendars.
    this._config.entities.forEach((entity) => {
      promises.push(
        this._hass
          .callWS({
            type: "call_service",
            domain: "calendar",
            service: "get_events",
            target: { entity_id: entity },
            service_data: {
              start_date_time: this.date.today,
              end_date_time: this.date.tomorrow,
            },
            return_response: true,
          })
          .then((r) => {
            for (const [k, v] of Object.entries(r.response)) {
                allEvents.push(...v.events);
            }
          })
          .catch((error) => {
            console.log(error);
          })
      );
    });

    // Wait until all requests either succeed or fail.
    await Promise.all(promises);

    this.data = allEvents.map((event) => {
      return {
        summary: event.summary,
        start: {
          date: event.start.split("T")[0],
          time: event.start?.split("T")[1].split("+")[0] || "00:00:00",
        },
        end: {
          date: event.end.split("T")[0],
          time: event.end?.split("T")[1].split("+")[0] || "23:59:00",
        },
      };
    });
  }

  markings() {
    let markers = [];
    let n = 0;
    for (let i = 0; i < 360; i += 15) {
      for (let j = 3.75; j < 15; j += 3.75) {
        markers.push(
          html`<div
            class="marking small"
            style="transform: rotate(${i + j}deg)"
          ></div>`
        );
      }
      markers.push(
        html`<div class="marking" style="transform: rotate(${i}deg)">
          <div style="padding-top: 20px;">
            <div
              class="hour"
              style="transform-origin: center; transform: rotate(${-i}deg);"
            >
              ${n}
            </div>
          </div>
        </div>`
      );
      n++;
    }
    return markers;
  }

  clock() {
    const weekdays = ["U", "M", "T", "W", "R", "F", "S"];
    const hours = this.currentTime.getHours();
    let dayOfWeek = this.currentTime.getDay();
    let date = this.currentTime.getDate();
    let hh = hours;
    let mm = this.currentTime.getMinutes();
    mm = mm < 10 ? "0" + mm : mm;
    return html` <div class="wrapper">
      <div class="clock">
        <div class="clock-content">
          <h2 class="time">${hh}:${mm}</h2>
          <div class="day">${weekdays[dayOfWeek]} ${date}</div>
        </div>
      </div>
    </div>`;
  }

  getDurationPercentage(startDeg, endDeg, endsOnFutureDate) {
    if (endDeg === 0) endDeg = 360;
    if (endsOnFutureDate) {
      if (startDeg > endDeg) endDeg += 360;
      if (endDeg > 360) endDeg = 360;
    } else {
      if (startDeg > endDeg) startDeg -= 360;
      if (startDeg < 0) startDeg = 0;
    }

    const durationInDeg = endDeg - startDeg;
    const durationInPercentage = (durationInDeg / 360) * 100;
    return durationInPercentage;
  }

  getRotation(hours, minutes) {
    const hoursRotation = (360 / 24) * hours;
    const minutesRotation = (360 / 24) * (minutes / 60);
    const rotation = hoursRotation + minutesRotation;
    return rotation;
  }

  hand() {
    const rotation = this.getRotation(
      this.currentTime.getHours(),
      this.currentTime.getMinutes()
    );
    return html`<div
      class="hand"
      style="transform: rotate(${rotation}deg)"
    ></div>`;
  }

  activities() {
    if (!this.data) return null;
    return this.data.map((activity, index) => {
      const localTime = this.currentTime?.toLocaleTimeString("sv-SE");
      const { today } = this.date;
      const hours = this.currentTime.getHours();
      const endsOnFutureDate = activity.end.date > today;
      const isPassed =
        today === activity.end.date && localTime > activity.end.time;

      const isFullDay =
        activity.start.date < activity.end.date &&
        activity.start.time === "00:00:00" &&
        activity.end.time === "23:59:00";
      const isActive =
        !isFullDay &&
        localTime > activity.start.time &&
        (localTime < activity.end.time || endsOnFutureDate);

      const [startHours, startMinutes] = activity.start.time.split(":");
      const [endHours, endMinutes] = activity.end.time.split(":");

      const activityStartsAtRotation = this.getRotation(
        startHours,
        startMinutes
      );
      const activityEndsAtRotation = this.getRotation(endHours, endMinutes);

      const duration = this.getDurationPercentage(
        activityStartsAtRotation,
        activityEndsAtRotation,
        endsOnFutureDate
      );
      const isEven = index % 2 === 0;
      let style = {
        backgroundColor: isEven ? "#0b4f70" : "#16597a",
        opacity: "0.8",
      };
      if (isActive) {
        style.backgroundColor = "#58afe4";
        style.opacity = "0.95";
      }
      if (isPassed) {
        style.backgroundColor = "#888";
        style.opacity = "0.5";
      }
      if (isFullDay) {
        if (!this._config.hide_full_day_events) {
          return html`<div class="full-day-activity">${activity.summary}</div>`;
        }
        return html``;
      }

      function getStartRotation() {
        if (endsOnFutureDate) {
          return activityStartsAtRotation;
        }
        if (activityStartsAtRotation > activityEndsAtRotation) {
          return 0;
        }
        return activityStartsAtRotation;
      }
      return html` <div
        class="activity ${isActive ? "active" : ""}"
        style="opacity: ${style.opacity}; 
              background: conic-gradient(${style.backgroundColor} ${duration}%, transparent 0); 
              transform: rotate(${getStartRotation()}deg);"
      >
        ${endsOnFutureDate
          ? html`<div
              class="continues 
                ${isActive ? "active" : ""} 
                ${isPassed ? "passed" : ""}"
              style="transform: rotate(${360 - activityStartsAtRotation}deg);"
            ></div>`
          : ""}
        <div
          class="${activityStartsAtRotation < 180
            ? "text-vertical-right"
            : "text-vertical-left"}"
        >
          ${activity.summary}
        </div>
      </div>`;
    });
  }

  static get styles() {
    return css`
      :host {
        --dark: #252526;
        --gray: #888;
        --lightblue: #58afe4;
        --backgroundBlue: #16597a;
        --red: red;
      }
      .continues::before {
        content: "";
        width: 20px;
        height: 20px;
        z-index: -1;
        position: absolute;
        top: 26px;
        left: -10px;
        background-image: linear-gradient(
          to top right,
          transparent 0 50%,
          var(--backgroundBlue) 50% 100%
        );
        transform: rotate(45deg);
        border-top-right-radius: 4px;
        border-bottom-left-radius: 4px;
      }
      .continues.active::before {
        background-color: var(--lightblue);
      }
      .continues.passed::before {
        background-color: var(--gray);
      }
      .duration {
        transform: translate(6px, 10px) rotate(7deg);
        color: rgb(172 224 255);
        top: 5px;
        left: 5px;
      }
      .wrapper {
        display: block;
        position: absolute;
        aspect-ratio: 1/1;
        width: 80px;
        z-index: 3;
        border-radius: 50%;
        background-color: var(--lightblue);
        border: 5px solid var(--dark);
      }
      .outer-clock {
        max-width: 380px;
        aspect-ratio: 1/1;
        margin: 0 auto;
        background: var(--dark);
        position: relative;
        display: grid;
        place-items: center;
        border-radius: 50%;
        overflow: hidden;
      }
      .activity[hidden] {
        display: none !important;
      }
      .full-day-activity {
        padding: 2px 10px;
        border-radius: 6px;
        background-color: var(--lightblue);
        border: 1px solid white;
        position: absolute;
        top: 30%;
        display: flex;
        justify-content: center;
        color: white;
        z-index: 1;
      }
      .activity {
        width: 100%;
        height: 100%;
        color: white;
        display: flex;
        position: absolute;
        top: 10px;
        left: 10px;
        border-radius: 50%;
        inset: 0;
        justify-content: center;
      }
      .marking {
        height: 100%;
        color: white;
        width: 4px;
        position: absolute;
        display: flex;
        justify-content: center;
        left: calc(50% - 2px);
        background-image: linear-gradient(
          to top,
          transparent 0% 96%,
          #eee 96% 100%
        );
      }
      .marking.small {
        width: 2px;
        background-image: linear-gradient(
          to top,
          transparent 0% 98%,
          #ccc 98% 100%
        );
      }
      .hand {
        background-image: linear-gradient(
          to top,
          transparent 0 50%,
          var(--red) 50% 100%
        );
        position: absolute;
        width: 2px;
        z-index: 2;
        height: 100%;
      }
      .clock {
        display: grid;
        height: 100%;
        place-items: center;
      }
      .clock-content {
        text-align: center;
      }
      .hour {
        font-size: 16px;
      }
      .time {
        font-size: 16px;
        font-weight: 900;
        margin: 0px;
      }
      .day {
        font-size: 13px;
        font-weight: 900;
        margin: 0px;
      }
      .active {
        font-weight: bold;
      }
      .text-vertical-left {
        position: absolute;
        font-size: 14px;
        left: 52%;
        transform-origin: left;
        transform: rotate(90deg);
      }
      .text-vertical-right {
        position: absolute;
        font-size: 14px;
        top: 33%;
        left: 52%;
        transform-origin: left;
        transform: rotate(-90deg);
      }
    `;
  }

  render() {
    if (!this._hass || !this.data) return html``;
    return html`
      <ha-card>
        <div class="card-content">
          <div class="outer-clock">
            ${this.markings()} ${this.clock()} ${this.hand()}
            ${this.activities()}
          </div>
        </div>
      </ha-card>
    `;
  }
}

customElements.define("dailygrapher-card", DailyGrapherCard);
