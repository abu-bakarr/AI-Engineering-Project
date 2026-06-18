#!/bin/sh
set -eu

CHROMA_URL="${CHROMA_URL:-http://localhost:8000}"
CHROMA_HEALTH_URL="$CHROMA_URL/api/v2/heartbeat"
CHROMA_CURL_TIMEOUT="${CHROMA_CURL_TIMEOUT:-2}"
CHROMA_STARTUP_ATTEMPTS="${CHROMA_STARTUP_ATTEMPTS:-15}"

if [ -z "${TESSDATA_PREFIX:-}" ]; then
  for tessdata_dir in \
    /usr/local/share/tessdata \
    /opt/homebrew/share/tessdata \
    /usr/share/tesseract-ocr/5/tessdata \
    /usr/share/tesseract-ocr/4.00/tessdata \
    /usr/share/tessdata
  do
    if [ -f "$tessdata_dir/eng.traineddata" ]; then
      export TESSDATA_PREFIX="$tessdata_dir"
      break
    fi
  done
fi

chroma_ready() {
  curl -fsS --max-time "$CHROMA_CURL_TIMEOUT" "$CHROMA_HEALTH_URL" >/dev/null 2>&1
}

stop_chroma() {
  if [ -n "${CHROMA_PID:-}" ] && kill -0 "$CHROMA_PID" >/dev/null 2>&1; then
    kill "$CHROMA_PID" >/dev/null 2>&1 || true
    i=0
    while kill -0 "$CHROMA_PID" >/dev/null 2>&1; do
      i=$((i + 1))
      if [ "$i" -ge 5 ]; then
        kill -9 "$CHROMA_PID" >/dev/null 2>&1 || true
        break
      fi
      sleep 1
    done
    wait "$CHROMA_PID" >/dev/null 2>&1 || true
  fi
}

mkdir -p ./rag/dataStore
node ./scripts/ensure-native-deps.mjs

if chroma_ready; then
  echo "Chroma is already running at $CHROMA_URL."
elif command -v chroma >/dev/null 2>&1 || [ -x ./node_modules/.bin/chroma ]; then
  if command -v chroma >/dev/null 2>&1; then
    CHROMA_BIN="$(command -v chroma)"
  else
    CHROMA_BIN="./node_modules/.bin/chroma"
  fi

  "$CHROMA_BIN" run --path ./rag/dataStore --host localhost --port 8000 &
  CHROMA_PID=$!
  trap 'stop_chroma' EXIT
  trap 'stop_chroma; exit 130' INT
  trap 'stop_chroma; exit 143' TERM

  i=0
  until chroma_ready; do
    i=$((i + 1))
    if ! kill -0 "$CHROMA_PID" >/dev/null 2>&1; then
      echo "Chroma exited before becoming ready at $CHROMA_URL. Continuing with Next.js."
      break
    fi
    if [ "$i" -ge "$CHROMA_STARTUP_ATTEMPTS" ]; then
      echo "Chroma did not become ready at $CHROMA_URL. Continuing with Next.js."
      stop_chroma
      break
    fi
    sleep 1
  done
else
  echo "Chroma CLI was not found. Run npm install to install project dependencies."
  echo "Continuing with Next.js; RAG will use local fallback when Chroma is unavailable."
fi

npm run dev:next
