#!/usr/bin/env bash
# Applies one named "app update" to the running OrangeHRM instance, for the
# test-healing study (CLAUDE.md decision 15): the kind of label or DOM change
# that breaks a test which used to pass. Deterministic, no rebuild.
#
#   app/break.sh <break-name>      apply one break
#   app/break.sh --list            list the available breaks
#
# Label breaks rewrite UI strings through OrangeHRM's own translation tables
# (the same mechanism as Admin -> Language Packages -> Translate), then clear
# the app's cache so the next page load picks them up. DOM breaks rename CSS
# classes consistently across the compiled JS and CSS bundles, like a UI
# library upgrade would; styling and behaviour stay intact.
#
# Every break is undone by a normal reset (`npm run cleanup:app && npm run
# setup:app`): the DB is a volume that gets removed, and web/dist lives in
# the image layer, not a volume. There is deliberately no "unbreak".
set -euo pipefail

APP_CONTAINER="ohrm-bench-app"
DB_CONTAINER="ohrm-bench-db"
# Created by app/install.sh from app/cli_install_config.yaml (databaseName).
DB_NAME="orangehrm_app"
DB_ROOT_PASSWORD="${OHRM_DB_ROOT_PASSWORD:-orangehrm_root}"
DIST="/var/www/html/web/dist"

if command -v podman >/dev/null 2>&1 && podman container exists "$APP_CONTAINER" 2>/dev/null; then
  ENGINE="podman"
elif command -v docker >/dev/null 2>&1; then
  ENGINE="docker"
else
  echo "Neither a podman container $APP_CONTAINER nor docker was found." >&2
  exit 1
fi

sql() {
  "$ENGINE" exec "$DB_CONTAINER" mariadb -uroot -p"$DB_ROOT_PASSWORD" "$DB_NAME" -N -e "$1"
}

# Sets the en_US text of one UI string (identified by its original English
# text and its translation group) to a new value.
relabel() {
  local group="$1" original="$2" replacement="$3"
  local id
  id="$(sql "SELECT s.id FROM ohrm_i18n_lang_string s JOIN ohrm_i18n_group g ON g.id = s.group_id WHERE g.name = '$group' AND s.value = '$original';")"
  if [[ -z "$id" || "$id" == *$'\n'* ]]; then
    echo "Expected exactly one '$original' string in group '$group', got: '${id:-none}'" >&2
    exit 1
  fi
  sql "DELETE t FROM ohrm_i18n_translate t JOIN ohrm_i18n_language l ON l.id = t.language_id WHERE l.code = 'en_US' AND t.lang_string_id = $id;
       INSERT INTO ohrm_i18n_translate (lang_string_id, language_id, value, customized)
         SELECT $id, id, '$replacement', 1 FROM ohrm_i18n_language WHERE code = 'en_US';"
  "$ENGINE" exec "$APP_CONTAINER" sh -c 'rm -rf /var/www/html/src/cache/orangehrm/*'
  echo "==> Relabelled '$original' -> '$replacement' (group $group, string $id)"
}

# Renames a CSS class prefix everywhere in the compiled bundles.
rename_class_prefix() {
  local from="$1" to="$2"
  "$ENGINE" exec "$APP_CONTAINER" sh -c "cd $DIST && sed -i 's/$from/$to/g' js/*.js css/*.css"
  local left
  left="$("$ENGINE" exec "$APP_CONTAINER" sh -c "cd $DIST && cat js/*.js css/*.css | grep -c '$from' || true")"
  if [[ "$left" != "0" ]]; then
    echo "Class prefix '$from' still present after rename ($left matches)" >&2
    exit 1
  fi
  echo "==> Renamed CSS class prefix '$from' -> '$to' in $DIST/{js,css}"
}

BREAKS="label-assign-button label-employee-hint dom-select dom-autocomplete"

case "${1:-}" in
  label-assign-button)  relabel leave "Assign" "Submit" ;;
  label-employee-hint)  relabel general "Type for hints..." "Start typing a name..." ;;
  dom-select)           rename_class_prefix "oxd-select-" "oxd-dropdown-" ;;
  dom-autocomplete)     rename_class_prefix "oxd-autocomplete-" "oxd-typeahead-" ;;
  --list)               tr ' ' '\n' <<<"$BREAKS" ;;
  *)
    echo "Usage: $0 <break-name> | --list" >&2
    echo "Breaks: $BREAKS" >&2
    exit 1 ;;
esac
