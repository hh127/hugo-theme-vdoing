# -*- coding: utf-8 -*-
"""
VuePress(vdoing) -> Hugo 内容迁移脚本

用法:  python tools/migrate_content.py [--src legacy/docs] [--dst content]

做的事:
  1. 把 legacy/docs 下的 markdown 复制到 content/, 目录/文件名去掉 "01." 这类排序前缀,
     前缀数值写入 front matter 的 weight (Hugo 用它做排序, 等价于 vdoing 的序号排序)。
  2. front matter: permalink -> url, date 归一化成 RFC3339, 其余字段原样保留。
  3. @pages/{archives,categories,tags}Page.md 改为 Hugo 的归档页 / 分类页 / 标签页。
  4. 00.目录页/*.md 的 pageComponent(Catalogue) 改为 layout: catalogue。
  5. body 里的 VuePress 容器语法 ::: tip 标题 / ::: 转成 Hugo shortcode {{% block %}}。
  6. docs/.vuepress/public/* 复制到 static/ (图片等静态资源)。
"""
import argparse
import io
import os
import re
import shutil
import sys

PREFIX_RE = re.compile(r'^(\d+)\.(.*)$')
FM_FENCE = '---'
DATE_RE = re.compile(r'^date:\s*(.+?)\s*$')
PERMALINK_RE = re.compile(r'^permalink:\s*(.+?)\s*$')
TITLE_RE = re.compile(r'^title:\s*(.+?)\s*$')
TOP_KEY_RE = re.compile(r'^([A-Za-z_][A-Za-z0-9_-]*):')
CONTAINER_OPEN_RE = re.compile(r'^:::\s*([A-Za-z][\w-]*)\s*(.*?)\s*$')
FENCE_RE = re.compile(r'^\s*(```|~~~)')

stats = {'pages': 0, 'containers': 0, 'no_url': [], 'keys': set(), 'dup_url': [], 'dup_keys': [],
         'unclosed': 0, 'null_items': 0, 'dup_h1': 0}
urls = {}


def split_front_matter(text):
    """返回 (front_matter_lines, body, has_fm)"""
    lines = text.replace('\r\n', '\n').replace('\r', '\n').split('\n')
    if not lines or lines[0].strip() != FM_FENCE:
        return [], lines, False
    for i in range(1, len(lines)):
        if lines[i].strip() == FM_FENCE:
            return lines[1:i], lines[i + 1:], True
    return [], lines, False


def strip_prefix(name):
    """'01.前端' -> (1, '前端'); '《Vue》笔记' -> (None, '《Vue》笔记')"""
    m = PREFIX_RE.match(name)
    if m:
        return int(m.group(1)), m.group(2)
    return None, name


def normalize_date(raw):
    raw = raw.strip().strip('"').strip("'")
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?', raw)
    if not m:
        return None
    y, mo, d = m.group(1), m.group(2), m.group(3)
    hh = m.group(4) or '00'
    mm = m.group(5) or '00'
    ss = m.group(6) or '00'
    return '%s-%s-%sT%s:%s:%s+08:00' % (y, mo, d, hh, mm, ss)


def normalize_permalink(raw):
    raw = raw.strip().strip('"').strip("'")
    if not raw:
        return ''
    if not raw.startswith('/'):
        raw = '/' + raw
    if re.search(r'\.(html?|htm)$', raw):
        return raw
    if not raw.endswith('/'):
        raw += '/'
    return raw


def convert_containers(body_lines):
    out = []
    in_fence = False
    fence_mark = ''
    stack = []  # 当前已打开的容器, 用于容忍原文档里未闭合/错位的 :::
    for line in body_lines:
        m = FENCE_RE.match(line)
        if m:
            mark = m.group(1)
            if not in_fence:
                in_fence = True
                fence_mark = mark
            elif line.strip().startswith(fence_mark):
                in_fence = False
            out.append(line)
            continue
        if not in_fence:
            stripped = line.strip()
            if stripped == ':::':
                if stack:
                    stack.pop()
                    out.append('{{% /block %}}')
                    stats['containers'] += 1
                else:
                    out.append(line)
                continue
            mo = CONTAINER_OPEN_RE.match(line)
            if mo:
                ctype = mo.group(1)
                title = mo.group(2).replace('"', "'")
                title = re.sub(r'^\[[^\]]*\]\s*', '', title).strip()
                stack.append(ctype)
                if title:
                    out.append('{{%% block type="%s" title="%s" %%}}' % (ctype, title))
                else:
                    out.append('{{%% block type="%s" %%}}' % ctype)
                stats['containers'] += 1
                continue
        out.append(line)
    if stack:
        stats['unclosed'] += len(stack)
        while stack:
            stack.pop()
            out.append('{{% /block %}}')
    return out


def hugo_weight(order):
    """Hugo 把 weight: 0 当作未设置(排到最后), 所以把 vdoing 从 0 开始的序号整体 +1"""
    return None if order is None else order + 1


def transform_front_matter(fm_lines, weight, extra=None, drop_keys=()):
    """逐行改写 front matter, 尽量保留原有字段和顺序"""
    out = []
    i = 0
    has_weight = False
    seen = set()
    while i < len(fm_lines):
        line = fm_lines[i]
        raw = line.strip()

        if re.match(r'^-\s*null\s*$', raw):
            stats['null_items'] += 1
            i += 1
            continue

        if not raw or raw.startswith('#'):
            out.append(line)
            i += 1
            continue

        # 缩进行属于上一个块的续行, 交给各分支自行消费
        top = TOP_KEY_RE.match(line)
        if not top:
            out.append(line)
            i += 1
            continue

        key = top.group(1)
        if key in drop_keys:
            # 丢掉该键(含其缩进续行)
            j = i + 1
            while j < len(fm_lines) and (fm_lines[j].startswith((' ', '\t')) and fm_lines[j].strip()):
                j += 1
            i = j
            continue

        if key == 'pageComponent':
            # 收集块内容
            j = i + 1
            block = []
            while j < len(fm_lines) and (fm_lines[j].startswith((' ', '\t')) and fm_lines[j].strip()):
                block.append(fm_lines[j])
                j += 1
            block_txt = '\n'.join(block)
            mp = re.search(r'^\s*path:\s*(.+?)\s*$', block_txt, re.M)
            ms = re.search(r'^\s*imgUrl:\s*(.+?)\s*$', block_txt, re.M)
            md = re.search(r'^\s*description:\s*(.+?)\s*$', block_txt, re.M)
            out.append('layout: catalogue')
            if mp:
                _, sec = strip_prefix(mp.group(1).strip().strip('"').strip("'"))
                out.append('catalogue: "%s"' % sec)
            if ms:
                out.append('imgUrl: %s' % ms.group(1))
            if md:
                out.append('description: %s' % md.group(1))
            i = j
            continue

        if key == 'permalink':
            m = PERMALINK_RE.match(line)
            url = normalize_permalink(m.group(1)) if m else ''
            if url:
                out.append('url: "%s"' % url)
            i += 1
            continue

        if key == 'date':
            m = DATE_RE.match(line)
            nd = normalize_date(m.group(1)) if m else None
            if nd:
                out.append('date: %s' % nd)
            else:
                out.append(line)
            i += 1
            continue

        if key == 'archivesPage':
            out.append('layout: archives')
            i += 1
            continue

        if key == 'weight':
            has_weight = True
            out.append(line)
            i += 1
            continue

        stats['keys'].add(key)
        seen.add(key)
        out.append(line)
        i += 1

    if extra:
        for k, v in extra.items():
            if k in seen:
                continue
            seen.add(k)
            out.append('%s: %s' % (k, v))
    if weight is not None and not has_weight:
        out.append('weight: %d' % weight)

    # 兜底: 去掉重复的顶级键(保留第一次出现的)
    final = []
    emitted = set()
    for line in out:
        m = TOP_KEY_RE.match(line)
        if m:
            if m.group(1) in emitted:
                stats['dup_keys'].append(m.group(1))
                continue
            emitted.add(m.group(1))
        final.append(line)
    return final


def strip_duplicate_h1(fm_lines, body_lines):
    """原文档常以 "# 标题" 开头, 与 front matter 的 title 重复, 这里去掉"""
    title = None
    for line in fm_lines:
        m = TITLE_RE.match(line)
        if m:
            title = m.group(1).strip().strip('"').strip("'")
            break
    if not title:
        return body_lines
    idx = 0
    while idx < len(body_lines) and not body_lines[idx].strip():
        idx += 1
    if idx >= len(body_lines):
        return body_lines
    line = body_lines[idx].strip()
    if line.startswith('# ') and line[2:].strip() == title:
        stats['dup_h1'] += 1
        rest = body_lines[idx + 1:]
        if rest and not rest[0].strip():
            rest = rest[1:]
        return rest
    return body_lines


def emit(path, fm_lines, body_lines):
    buf = [FM_FENCE]
    buf.extend(fm_lines)
    buf.append(FM_FENCE)
    buf.extend(body_lines)
    text = '\n'.join(buf).rstrip('\n') + '\n'
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


def convert_page(src, dst, rel_dir='', extra=None, drop_keys=(), weight=None):
    with io.open(src, encoding='utf-8') as f:
        text = f.read()
    fm, body, has_fm = split_front_matter(text)
    if not has_fm:
        fm = []
    fm2 = transform_front_matter(fm, weight, extra=extra, drop_keys=drop_keys)
    body2 = convert_containers(body)
    body2 = strip_duplicate_h1(fm2, body2)
    emit(dst, fm2, body2)
    stats['pages'] += 1
    has_url = False
    for l in fm2:
        if l.strip().startswith('url:'):
            has_url = True
            u = l.split(':', 1)[1].strip().strip('"')
            if u in urls:
                stats['dup_url'].append((u, urls[u], dst))
            urls[u] = dst
    if not has_url:
        stats['no_url'].append(dst)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='legacy/docs')
    ap.add_argument('--dst', default='content')
    args = ap.parse_args()

    src_root = os.path.abspath(args.src)
    dst_root = os.path.abspath(args.dst)
    if os.path.isdir(dst_root):
        shutil.rmtree(dst_root)
    os.makedirs(dst_root, exist_ok=True)

    # ---- 1. 首页 ----
    home_src = os.path.join(src_root, 'index.md')
    if os.path.isfile(home_src):
        with io.open(home_src, encoding='utf-8') as f:
            fm, body, _ = split_front_matter(f.read())
        fm2 = transform_front_matter(fm, None, extra={'title': '首页'}, drop_keys=('home',))
        emit(os.path.join(dst_root, '_index.md'), fm2, [])

    # ---- 2. @pages ----
    pages_dir = os.path.join(src_root, '@pages')
    if os.path.isdir(pages_dir):
        arch = os.path.join(pages_dir, 'archivesPage.md')
        if os.path.isfile(arch):
            convert_page(arch, os.path.join(dst_root, 'archives.md'),
                         extra={'layout': 'archives'}, drop_keys=('archivesPage',))
        # categoriesPage / tagsPage 由 Hugo taxonomy 自动生成, 不需要内容文件

    # ---- 3. 普通内容 ----
    for entry in sorted(os.listdir(src_root)):
        s = os.path.join(src_root, entry)
        if not os.path.isdir(s):
            continue
        if entry in ('.vuepress', '@pages'):
            continue

        if entry == '_posts':
            # _posts 在 Hugo 里下划线开头会被忽略, 改名 posts; 文件名本身不带序号
            for dp, dn, fn in os.walk(s):
                for f in sorted(fn):
                    if not f.endswith('.md'):
                        continue
                    sp = os.path.join(dp, f)
                    rel = os.path.relpath(sp, s)
                    tt, name = strip_prefix(os.path.splitext(rel)[0])
                    name = name + '.md'
                    target = os.path.join(dst_root, 'posts', name)
                    convert_page(sp, target, weight=hugo_weight(tt))
            continue

        weight, name = strip_prefix(entry)
        is_catalogue = entry.startswith('00.目录页')
        out_dir = os.path.join(dst_root, 'catalogue' if is_catalogue else name)

        for dp, dn, fn in os.walk(s):
            rel_dir = os.path.relpath(dp, s)
            parts = [] if rel_dir == '.' else rel_dir.split(os.sep)
            clean_parts = []
            dir_weight = weight
            for p in parts:
                w_p, pname = strip_prefix(p)
                if w_p is not None:
                    dir_weight = w_p
                clean_parts.append(pname)
            out_dir_here = os.path.join(out_dir, *clean_parts)
            out_dir_here = os.path.normpath(out_dir_here).replace(os.sep, '/')

            # 目录 _index.md
            os.makedirs(out_dir_here, exist_ok=True)
            idx = os.path.join(dp, '_index.md')
            sec_title = clean_parts[-1] if clean_parts else name
            if os.path.isfile(idx):
                with io.open(idx, encoding='utf-8') as f:
                    fm, body, _ = split_front_matter(f.read())
                # 去掉内容文件里手写的目录页, 结构化侧边栏由 Hugo 分组承担
                fm2 = transform_front_matter(fm, hugo_weight(dir_weight), drop_keys=('permalink',))
                emit(os.path.join(out_dir_here, '_index.md'), fm2, [])
            else:
                fm_lines = ['title: "%s"' % sec_title]
                fm_lines.append('weight: %d' % (hugo_weight(dir_weight) if dir_weight is not None else 100000))
                fm_lines.append('build:')
                fm_lines.append('  render: never')
                emit(os.path.join(out_dir_here, '_index.md'), fm_lines, [])

            for f in sorted(fn):
                if not f.endswith('.md') or f == '_index.md':
                    continue
                sp = os.path.join(dp, f)
                w, fname = strip_prefix(os.path.splitext(f)[0])
                if is_catalogue:
                    extra = {'layout': 'catalogue'}
                    convert_page(sp, os.path.join(out_dir_here, fname + '.md'), weight=hugo_weight(w), extra=extra)
                else:
                    convert_page(sp, os.path.join(out_dir_here, fname + '.md'), weight=hugo_weight(w))

    # ---- 4. 静态资源 ----
    pub = os.path.join(src_root, '.vuepress', 'public')
    if os.path.isdir(pub):
        static_root = os.path.abspath('static')
        shutil.copytree(pub, static_root, dirs_exist_ok=True)

    # ---- 报告 ----
    print('migrated pages : %d' % stats['pages'])
    print('containers     : %d' % stats['containers'])
    print('unclosed blocks auto-closed: %d' % stats['unclosed'])
    print('duplicate h1 removed      : %d' % stats['dup_h1'])
    print('empty (null) list items   : %d' % stats['null_items'])
    print('front keys seen: %s' % ', '.join(sorted(stats['keys'])))
    if stats['no_url']:
        print('pages without permalink -> Hugo default URL (%d):' % len(stats['no_url']))
        for p in stats['no_url']:
            print('   ', os.path.relpath(p, dst_root))
    if stats['dup_url']:
        print('!!! duplicate url (%d):' % len(stats['dup_url']))
        for u, a, b in stats['dup_url']:
            print('   ', u, '->', os.path.relpath(a, dst_root), '|', os.path.relpath(b, dst_root))


if __name__ == '__main__':
    main()
