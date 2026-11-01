import os
import re
import sys
import collections
from urllib.parse import unquote

sys.stdout.reconfigure(encoding='utf-8')
PUB = 'public'

# 收集所有已生成的路径(去重)
have = set()
for dp, dn, fn in os.walk(PUB):
    rel = os.path.relpath(dp, PUB).replace('\\', '/')
    rel = '' if rel == '.' else rel
    have.add('/' + (rel + '/' if rel else ''))
    for f in fn:
        have.add('/' + (rel + '/' if rel else '') + f)

href_re = re.compile(r'(?:href|src)="([^"]+)"')
missing = collections.Counter()
missing_src = collections.defaultdict(list)
total = 0
pages = 0

for dp, dn, fn in os.walk(PUB):
    for f in fn:
        if not f.endswith('.html'):
            continue
        pages += 1
        path = os.path.join(dp, f)
        with open(path, encoding='utf-8') as fh:
            t = fh.read()
        for url in href_re.findall(t):
            if url.startswith(('http://', 'https://', '//', 'mailto:', '#', 'data:', 'javascript:')):
                continue
            total += 1
            u = url.split('#')[0].split('?')[0]
            u = unquote(u)
            if not u:
                continue
            if u in have:
                continue
            if u.endswith('/') and u in have:
                continue
            if not u.endswith('/') and (u + '/') in have:
                continue
            if not u.endswith('/') and u in have:
                continue
            missing[u] += 1
            if len(missing_src[u]) < 3:
                missing_src[u].append(path.replace(PUB + '\\', '').replace('\\', '/'))

print('html pages:', pages, 'internal refs:', total, 'missing:', len(missing), 'refs:', sum(missing.values()))
for u, n in missing.most_common(40):
    print('%5d  %-70s %s' % (n, u, missing_src[u][:2]))
