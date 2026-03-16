# Tracker Dashboard

If you see raw code blocks instead of tables:
1. Switch to Reading view in Obsidian.
2. Enable community plugins Dataview and Tasks.
3. In Dataview settings, enable JavaScript queries if prompted.

Without plugins, use the folder links below:
- Tasks folder: [[Tasks]]
- Pages folder: [[Pages]]

## Task Table
```dataview
TABLE phase, status, type, difficulty, duration, linked_page, updated
FROM "Tasks"
SORT phase ASC, file.name ASC
```

## Open Tasks
```tasks
not done
path includes Tasks
sort by due
```

## By Status
```dataview
TABLE rows.file.link AS Tasks
FROM "Tasks"
GROUP BY status
SORT status ASC
```

## No-Plugin Fallback
- Open [[Tasks]] and sort by modified date.
- Open [[Pages]] for all linked content notes.
