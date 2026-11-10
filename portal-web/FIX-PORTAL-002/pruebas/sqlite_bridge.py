"""Adaptador de pruebas local de SQLite; no es código de producción."""
import sys,json,sqlite3
payload=json.load(sys.stdin)
with sqlite3.connect(payload['database']) as con:
 con.row_factory=sqlite3.Row;con.execute('PRAGMA foreign_keys=ON')
 if payload.get('schema'):
  con.executescript(payload['schema']);print('{}')
 else:
  results=[]
  for q in payload['queries']:
   cur=con.execute(q['sql'],q.get('params',[]));rows=[dict(r) for r in cur.fetchall()] if cur.description else []
   results.append({'results':rows,'meta':{'changes':max(cur.rowcount,0)}})
  print(json.dumps(results))
