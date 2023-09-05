import html from "html";

export function Skaffold({ children }: { children: html.Children }) {
    return (<html>
        <head>
            <script src="https://unpkg.com/htmx.org@1.9.4" integrity="sha384-zUfuhFKKZCbHTY6aRR46gxiqszMk5tcHjsVFxnUo8VMus4kHGVdIYVbOYYNlKmHV" crossorigin="anonymous"></script>
            <script src="/scripts.js"></script>
            <link rel="stylesheet" href="/styles.css" />
        </head>
        <body>
            <header>

            </header>
            <main>
                {children}
            </main>
        </body>
    </html>)
}


export function MainPage({ events }: { events: Entry[] }) {
    return (<>
        <TimeTrackerBar />
        <TimeEntryList events={events} />
    </>)
}

export type Entry = {
    id: string,
    description: string,
    start: Date,
    stop: Date, 
}

export function TimeEntryList({ events }: { events: Entry[]}) {
    return (<div id="entry-list">
        {events.sort((a,b) => +b.start - +a.start).map(entry => <TimeEntry {...entry}/>)}
    </div>)
}

export function TimeEntry(props: Entry) {
    // TODO: fix this
    const start = props.start.toLocaleTimeString('de', { minute: 'numeric', hour: 'numeric' });
    const stop = props.stop.toLocaleTimeString('de', { minute: 'numeric', hour: 'numeric' });
    const date = props.start.toISOString().split('T')[0]

    return ((<article class="time-entry" id={props.id}>
        <form hx-on="htmx:beforeRequest: timeupdateConfig(event)">
            <input 
                type="hidden"
                name="id"
                value={props.id}
            />
            <input 
                type="hidden"
                name="startDate"
                value={props.start.toISOString()}
            />
            <input 
                type="hidden"
                name="stopDate"
                value={props.stop.toISOString()}
            />
            <input
                type="text"
                name="description"
                hx-post="entry"
                hx-trigger="keyup changed delay:500ms"
                value={props.description}
            />
            <input type="date" value={date} disabled />
            <input type="time" name="start" value={start} hx-post="entry" hx-trigger="change delay:100ms" />
            <input type="time" name="stop" value={stop} hx-post="entry" hx-trigger="change delay:100ms" />
            <button 
                hx-delete="entry"
                hx-target="closest .time-entry"
                hx-swap="delete"
                hx-confirm="are you sure?"
            >Delete</button>
        </form>
    </article>));
}

type TimeTrackerProps = {
    running?: boolean,
    description?: string,
    startedAt?: string,
}
export function TimeTrackerBar({ running, startedAt, description }: TimeTrackerProps) {
    if (running) {
        return (
        <form class="tracker-bar" hx-post="/tracker-stop" hx-swap="outerHTML" hx-select-oob="#entry-list:afterbegin">
            <input id="timer-desc" name="description" type="text" value={description}></input>
            <input id="timer-started-at" type="text" name="startedAt" value={startedAt}></input>
            <button class="stop" type="submit">Stop</button>
        </form>);
    }
    return (
        <form class="tracker-bar" hx-post="/tracker-start" hx-swap="outerHTML">
            <input id="timer-desc" name="description" type="text"></input>
            <button class="start" type="submit">Start</button>
        </form>
    );
}


