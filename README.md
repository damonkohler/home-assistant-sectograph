# Sectograph
A custom card that shows calendar events on a 24-hour sectograph.

## Usage
Add a custom card with the following settings:

```yaml
type: custom:sectograph-card
entities: 
    - calendar.calendar_id
    - calendar.calendar_id_2
hide_full_day_events: true
```
### Options
entities: should be existing, valid calendar entities.

hide_full_day_events: (boolean) all day events are shown separately if enabled.

# Adding a custom repo to HACS
1. Go to any of the sections (integrations, frontend, automation).
1. Click on the 3 dots in the top right corner.
1. Select "Custom repositories"
1. Add the URL to the repository. (https://github.com/damonkohler/home-assistant-sectograph)
1. Select the Frontend category.
1. Click the "Add" button.
