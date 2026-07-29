#!/usr/bin/env bash

set -euo pipefail

usage() {
	cat <<'EOF'
Usage: bin/check-dynamic-render.sh [options] <URL-or-file>

Scan rendered HTML for common Builderius dynamic-data failures.

Options:
  --cookie FILE          Pass a Netscape cookie jar to curl.
  --insecure             Allow a self-signed HTTPS certificate.
  --expect TEXT          Require TEXT to appear (repeatable).
  --nonblank-label TEXT  Require visible text after TEXT (repeatable).
  -h, --help             Show this help.
EOF
}

cookies=""
insecure=false
source_value=""
expects=()
nonblank_labels=()

while [ "$#" -gt 0 ]; do
	case "$1" in
		--cookie)
			[ "$#" -ge 2 ] || { echo "--cookie needs a file." >&2; exit 2; }
			cookies="$2"
			shift 2
			;;
		--insecure)
			insecure=true
			shift
			;;
		--expect)
			[ "$#" -ge 2 ] || { echo "--expect needs text." >&2; exit 2; }
			expects+=("$2")
			shift 2
			;;
		--nonblank-label)
			[ "$#" -ge 2 ] || { echo "--nonblank-label needs text." >&2; exit 2; }
			nonblank_labels+=("$2")
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		-*)
			echo "Unknown option: $1" >&2
			usage >&2
			exit 2
			;;
		*)
			[ -z "$source_value" ] || { echo "Pass one URL or file." >&2; exit 2; }
			source_value="$1"
			shift
			;;
	esac
done

[ -n "$source_value" ] || { usage >&2; exit 2; }

html_file="$(mktemp "${TMPDIR:-/tmp}/dbe-dynamic-render.XXXXXX")"
scan_file="$(mktemp "${TMPDIR:-/tmp}/dbe-dynamic-scan.XXXXXX")"
trap 'rm -f "$html_file" "$scan_file"' EXIT

case "$source_value" in
	http://*|https://*)
		curl_args=(-fsSL)
		[ "$insecure" = false ] || curl_args+=(-k)
		[ -z "$cookies" ] || curl_args+=(-b "$cookies")
		curl "${curl_args[@]}" -o "$html_file" "$source_value"
		;;
	*)
		[ -f "$source_value" ] || { echo "File not found: $source_value" >&2; exit 2; }
		cp "$source_value" "$html_file"
		;;
esac

php -r '$html = file_get_contents($argv[1]); $html = preg_replace("/<script\\b[^>]*>.*?<\\/script>/is", "", $html); $html = preg_replace("/<style\\b[^>]*>.*?<\\/style>/is", "", $html); $html = preg_replace("/<!--.*?-->/s", "", $html); file_put_contents($argv[2], $html);' "$html_file" "$scan_file"

failures=0

report_matches() {
	local label="$1"
	local pattern="$2"
	local matches

	matches="$(grep -En "$pattern" "$scan_file" || true)"
	if [ -n "$matches" ]; then
		echo "FAIL: $label" >&2
		sed -n '1,10p' <<< "$matches" >&2
		failures=$((failures + 1))
	fi
}

report_matches "PHP warning or fatal error found" 'Fatal error|Warning:'
report_matches "unrendered <template> found" '<template([[:space:]>])'
report_matches "unresolved square-bracket binding found" '\[\[\[?[^][]+\]\]\]?'
report_matches "unresolved curly-bracket binding found" '\{\{\{?[^{}]+\}\}\}?'

if [ "${#expects[@]}" -gt 0 ]; then
	for expected in "${expects[@]}"; do
		if ! grep -Fq -- "$expected" "$html_file"; then
			echo "FAIL: expected text not found: $expected" >&2
			failures=$((failures + 1))
		fi
	done
fi

if [ "${#nonblank_labels[@]}" -gt 0 ]; then
	for label in "${nonblank_labels[@]}"; do
		if ! php -r '$dom = new DOMDocument(); libxml_use_internal_errors(true); $dom->loadHTML(file_get_contents($argv[1])); $label = $argv[2]; foreach ((new DOMXPath($dom))->query("//text()") as $node) { if (false === strpos($node->nodeValue, $label)) { continue; } $text = $node->parentNode->textContent; $suffix = substr($text, strpos($text, $label) + strlen($label)); if ("" !== trim($suffix)) { exit(0); } } exit(1);' "$html_file" "$label"; then
			echo "FAIL: no visible value follows label: $label" >&2
			failures=$((failures + 1))
		fi
	done
fi

if [ "$failures" -gt 0 ]; then
	echo "Dynamic render check failed with $failures issue(s)." >&2
	exit 1
fi

echo "Dynamic render check passed."
