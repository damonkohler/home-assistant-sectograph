import {
  LitElement,
  html,
  css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

class SectographCard extends LitElement {
  static get properties() {
    return {
      _hass: {},
      _config: {
        hide_full_day_events: false,
      },
      now: {},
      date: {},
      data: {},
    };
  }

  setConfig(config) {
    if (!config.entities) {
      throw new Error("You need to define entities");
    }
    this._config = config;
    this.now = new Date();
    this.today = new Date(this.now);
    this.today.setHours(0, 0, 0, 0);
    this.tomorrow = new Date(this.today);
    this.tomorrow.setDate(this.now.getDate() + 1);
    this.interval = window.setInterval(() => {
      this.now = new Date();
    }, 10000);
  }

  set hass(hass) {
    this._hass = hass;
    if (this.data) return null;
    this.getCalendarEvents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.clearInterval(this.interval);
  }

  async getCalendarEvents() {
    let allEvents = [];
    let promises = [];
    this._config.entities.forEach((entity) => {
      promises.push(
        this._hass
          .callWS({
            type: "call_service",
            domain: "calendar",
            service: "get_events",
            target: { entity_id: entity },
            service_data: {
              start_date_time: this.today.toLocaleDateString("sv-SE"),
              end_date_time: this.tomorrow.toLocaleDateString("sv-SE"),
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

    await Promise.all(promises);

    this.data = allEvents.map((event) => {
      return {
        summary: event.summary,
        start: new Date(event.start),
        end: new Date(event.end),
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
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hours = this.now.getHours();
    let dayOfWeek = this.now.getDay();
    let date = this.now.getDate();
    let hh = hours;
    let mm = this.now.getMinutes();
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

  getRotation(date) {
    return (360 / 24) * (date.getHours() + date.getMinutes() / 60);
  }

  hand() {
    const rotation = this.getRotation(this.now);
    return html`<div
      class="hand"
      style="transform: rotate(${rotation}deg)"
    ></div>`;
  }

  events() {
    if (!this.data) return null;
    return this.data.map((event, index) => {
      const endsOnFutureDate = event.end >= this.tomorrow;
      const isPast = event.end < this.now;
      const isAllDay = event.end - event.start >= 8.64e7;
      const isInProgress =
        !isAllDay && event.start < this.now && this.now < event.end;
      const startRotation = this.getRotation(event.start);
      const endRotation = this.getRotation(event.end);
      const duration = this.getDurationPercentage(
        startRotation,
        endRotation,
        endsOnFutureDate
      );
      let style = {
        backgroundColor: index % 2 ? "var(--backgroundBlue)" : "#0b4f70",
        opacity: "0.8",
      };
      if (isInProgress) {
        style.backgroundColor = "var(--lightblue)";
        style.opacity = "0.95";
      }
      if (isPast) {
        style.backgroundColor = "var(--gray)";
        style.opacity = "0.5";
      }
      if (isAllDay) {
        if (!this._config.hide_full_day_events) {
          return html`<div class="full-day-event">${event.summary}</div>`;
        }
        return html``;
      }

      function getStartRotation() {
        if (endsOnFutureDate) {
          return startRotation;
        }
        if (startRotation > endRotation) {
          return 0;
        }
        return startRotation;
      }
      return html` <div
        class="event ${isInProgress ? "active" : ""}"
        style="opacity: ${style.opacity}; 
              background: conic-gradient(${style.backgroundColor} ${duration}%, transparent 0); 
              transform: rotate(${getStartRotation()}deg);"
      >
        ${endsOnFutureDate
          ? html`<div
              class="continues 
                ${isInProgress ? "active" : ""} 
                ${isPast ? "past" : ""}"
              style="transform: rotate(${360 - startRotation}deg);"
            ></div>`
          : ""}
        <div
          class="${startRotation < 180
            ? "text-vertical-right"
            : "text-vertical-left"}"
        >
          ${event.summary}
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
        transform: rotate(45deg);
        border-top-right-radius: 4px;
        border-bottom-left-radius: 4px;
      }
      .continues.active::before {
        background-image: linear-gradient(
          to top right,
          transparent 0 50%,
          var(--lightblue) 50% 100%
        );
      }
      .continues.past::before {
        background-image: linear-gradient(
          to top right,
          transparent 0 50%,
          var(--backgroundBlue) 50% 100%
        );
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
      .event[hidden] {
        display: none !important;
      }
      .full-day-event {
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
      .event {
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
            ${this.markings()} ${this.clock()} ${this.hand()} ${this.events()}
          </div>
        </div>
      </ha-card>
    `;
  }
}

customElements.define("sectograph-card", SectographCard);
