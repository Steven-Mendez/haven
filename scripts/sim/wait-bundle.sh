#!/usr/bin/env bash
# Waits until the shared Metro (:8081) builds the iOS bundle without errors (max ~20 min).
# The bundle is shared by every simulator: another feature's broken import turns it red for everyone.
URL='http://localhost:8081/node_modules/expo-router/entry.bundle?platform=ios&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=src%2Fapp&app=app.haven.mobile'
for i in $(seq 1 40); do
  code=$(curl -s -o /tmp/haven-bundle-check.txt -w '%{http_code}' --max-time 240 "$URL")
  if [ "$code" = 200 ]; then echo "bundle OK"; exit 0; fi
  msg=$(python3 -c "import json;d=json.load(open('/tmp/haven-bundle-check.txt'));print(d.get('message','')[:300])" 2>/dev/null)
  echo "[$i] bundle error ($code): $msg"; sleep 30
done
exit 1
