# Maneuver Dashboard

This dashboard renders live data from the World of Tanks API for every member of a clan.
It combines PHP for data aggregation with vanilla CSS/JS for the neon-styled interface.

## Getting the latest code

If you have published updates to GitHub, run the helper script so this workspace stays
in sync with your remote changes:

```bash
scripts/update_from_github.sh https://github.com/your-user/your-repo.git work
```

The script will configure the `origin` remote when necessary, fetch the requested branch,
and reset the working tree to match `origin/<branch>`.

## Local development

1. Install PHP 8.1+ with cURL enabled.
2. Provide a World of Tanks API key via the `WOT_APP_ID` environment variable when you
   need to override the bundled demo key.
3. Serve the project through `php -S localhost:8000` or any web server that can execute
   PHP files.
4. Load `index.php` and use the realm/clan/player selectors to explore live stats.
