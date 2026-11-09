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
  7. body 里残留的 Vue 组件原始标签 <code-group> / <code-block> 转成
     {{< code-group >}} / {{< code-block title="..." active="true" >}} 短代码
     (原 CodeGroup.vue / CodeBlock.vue 的等价写法, 避免渲染成裸 HTML)。
  8. 对齐原 setFrontmatter.js: 给缺 categories 的文章补默认分类
     (目录层级派生; _posts 碎片化文章用 --category-text, 默认读 hugo.toml params.categoryText),
     并按 --extend-frontmatter 追加生成 frontmatter 的扩展字段 (原 themeConfig.extendFrontmatter)。
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

# Vue 组件原始标签 (迁移漏转的) -> Hugo 短代码
CODE_GROUP_OPEN_RE = re.compile(r'^\s*<code-group(?:\s[^>]*)?>\s*$', re.I)
CODE_GROUP_CLOSE_RE = re.compile(r'^\s*</code-group\s*>\s*$', re.I)
CODE_BLOCK_OPEN_RE = re.compile(r'^\s*<code-block\b([^>]*)>\s*$', re.I)
CODE_BLOCK_CLOSE_RE = re.compile(r'^\s*</code-block\s*>\s*$', re.I)
CODE_BLOCK_ONE_LINE_RE = re.compile(r'^\s*<code-block\b([^>]*)>(.*?)</code-block\s*>\s*$', re.I)
ATTR_RE = re.compile(r'([A-Za-z_:][-A-Za-z0-9_:.]*)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s"\'>]+))?')

stats = {'pages': 0, 'containers': 0, 'no_url': [], 'keys': set(), 'dup_url': [], 'dup_keys': [],
         'unclosed': 0, 'null_items': 0, 'dup_h1': 0,
         'code_groups': 0, 'code_blocks': 0, 'default_categories': 0, 'extend_keys': 0}
urls = {}

# 站点配置与生成 frontmatter 的扩展字段 (main() 里填充)
SITE_PARAMS = {}
EXTEND_FM = {}
DST_ROOT = ''


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


def mark_comment_lines(lines):
    """返回逐行是否位于 HTML 注释内: 注释里的 ::: / <code-group> 不能转短代码
    (否则 Hugo 仍会执行短代码, 被注释掉的 demo 会复活)。"""
    flags = []
    in_comment = False
    for line in lines:
        starts_here = '<!--' in line and '-->' not in line
        flags.append(in_comment or starts_here)
        if in_comment:
            if '-->' in line:
                in_comment = False
        elif starts_here:
            in_comment = True
    return flags


def convert_containers(body_lines):
    out = []
    in_fence = False
    fence_mark = ''
    stack = []  # 当前已打开的容器, 用于容忍原文档里未闭合/错位的 :::
    comment_flags = mark_comment_lines(body_lines)
    for idx, line in enumerate(body_lines):
        if comment_flags[idx]:
            # HTML 注释内的内容保持原样, 也不参与容器栈配对
            out.append(line)
            continue
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


# ---------------------------------------------------------------------------
# 站点配置 / 扩展 frontmatter (对应原 setFrontmatter.js:18,105-112,128-157)
# ---------------------------------------------------------------------------
def load_site_params(config_path):
    """读取 hugo.toml 的 [params], 拿 categoryText / category / tag 等开关"""
    try:
        try:
            import tomllib  # Python 3.11+
        except ImportError:  # pragma: no cover
            import tomli as tomllib  # type: ignore
        with io.open(config_path, 'rb') as f:
            data = tomllib.load(f)
        params = data.get('params') or {}
        if isinstance(params, dict):
            # TOML 键大小写不敏感地取一遍, 统一成小写键方便后续判断
            return {str(k).lower(): v for k, v in params.items()}
    except Exception as e:  # 文件不存在/语法错误时不阻塞迁移
        print('warn: 读取 %s 失败 (%s), 使用默认值' % (config_path, e))
    return {}


def parse_extend_frontmatter(text):
    """把 --extend-frontmatter 传入的 YAML 片段解析成 {key: [原始行...]}

    例:  --extend-frontmatter $'author:\n  name: xugaoyi'
    ->   {'author': ['author:', '  name: xugaoyi']}
    """
    result = {}
    if not text:
        return result
    cur = None
    for line in text.replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        raw = line.rstrip()
        if not raw.strip() or raw.lstrip().startswith('#'):
            continue
        if not raw.startswith((' ', '\t')):
            m = TOP_KEY_RE.match(raw)
            if not m:
                continue
            cur = m.group(1)
            result[cur] = [raw]
        elif cur:
            result[cur].append(raw)
    return result


def shortcode_attrs(attr_text):
    """<code-block title="NPM" active lang="bash"> -> ['title="NPM"', 'active="true"']"""
    out = []
    for m in ATTR_RE.finditer(attr_text or ''):
        name = m.group(1).lower()
        if name not in ('title', 'active', 'lang'):
            continue
        val = m.group(2)
        if val is None:
            val = 'true' if name == 'active' else ''
        val = val.strip('"').strip("'")
        if name == 'active':
            if val.strip().lower() in ('false', '0', 'no', ''):
                continue
            val = 'true'
        if not val:
            continue
        out.append('%s="%s"' % (name, val.replace('"', '&quot;')))
    return out


def dedent_lines(lines):
    """去掉一组行的公共行首缩进 (原始 <code-block> 内代码通常整体缩进 2 空格)"""
    min_indent = None
    for line in lines:
        if not line.strip():
            continue
        indent = len(line) - len(line.lstrip(' '))
        min_indent = indent if min_indent is None else min(min_indent, indent)
    if not min_indent:
        return lines
    return [line[min_indent:] if line.strip() else '' for line in lines]


def block_open_shortcode(attr_text):
    attrs = shortcode_attrs(attr_text)
    return '{{< code-block%s >}}' % ((' ' + ' '.join(attrs)) if attrs else '')


def convert_code_components(body_lines):
    """残留的 <code-group>/<code-block> 原始 HTML -> Hugo 短代码

    对应 themes/vdoing/layouts/shortcodes/code-group.html / code-block.html。
    不处理代码围栏内部的同名文本 (那是示例代码, 不能改)。
    """
    out = []
    in_fence = False
    fence_mark = ''
    i = 0
    n = len(body_lines)
    comment_flags = mark_comment_lines(body_lines)
    while i < n:
        line = body_lines[i]
        if comment_flags[i]:
            out.append(line)
            i += 1
            continue
        m = FENCE_RE.match(line)
        if m and not in_fence:
            in_fence = True
            fence_mark = m.group(1)
            out.append(line)
            i += 1
            continue
        if in_fence:
            if line.strip().startswith(fence_mark):
                in_fence = False
            out.append(line)
            i += 1
            continue
        if CODE_GROUP_OPEN_RE.match(line):
            out.append('{{< code-group >}}')
            stats['code_groups'] += 1
            i += 1
            continue
        if CODE_GROUP_CLOSE_RE.match(line):
            out.append('{{< /code-group >}}')
            i += 1
            continue
        mc = CODE_BLOCK_ONE_LINE_RE.match(line)
        if mc:
            out.append(block_open_shortcode(mc.group(1)))
            inner = mc.group(2).strip()
            if inner:
                out.append(inner)
            out.append('{{< /code-block >}}')
            stats['code_blocks'] += 1
            i += 1
            continue
        mb = CODE_BLOCK_OPEN_RE.match(line)
        if mb:
            inner = []
            j = i + 1
            while j < n and not CODE_BLOCK_CLOSE_RE.match(body_lines[j]):
                inner.append(body_lines[j])
                j += 1
            out.append(block_open_shortcode(mb.group(1)))
            out.extend(dedent_lines(inner))
            out.append('{{< /code-block >}}')
            stats['code_blocks'] += 1
            i = j + 1  # 跳过 </code-block>
            continue
        out.append(line)
        i += 1
    return out


def _top_keys(fm_lines):
    keys = set()
    for line in fm_lines:
        m = TOP_KEY_RE.match(line)
        if m:
            keys.add(m.group(1))
    return keys


def is_article_front_matter(fm_lines, dst_path):
    """判断是否「文章页」: 原 setFrontmatter.js:93 只给文章页补 categories/tags"""
    rel = os.path.relpath(dst_path, DST_ROOT).replace(os.sep, '/') if DST_ROOT else dst_path
    if os.path.basename(rel) == '_index.md':
        return False
    keys = _top_keys(fm_lines)
    if 'layout' in keys:        # archives / catalogue 等页面组件页
        return False
    for line in fm_lines:
        if re.match(r'^article:\s*false\s*$', line.strip()):
            return False
    return True


def categories_for(dst_path, category_text):
    """按目录层级派生分类 (原 setFrontmatter.js:128-157 getCategories)

    - _posts / posts 下的碎片化文章: 用子目录名, 没有子目录则用 categoryText
    - 其它文章: docs 之后的各层目录名 (已去掉 "01." 之类序号)
    """
    rel = os.path.relpath(dst_path, DST_ROOT).replace(os.sep, '/') if DST_ROOT else dst_path.replace(os.sep, '/')
    parts = [p for p in rel.split('/')[:-1] if p and p != '.']
    if parts and parts[0] == 'posts':
        sub = parts[1:]
        return sub if sub else [category_text]
    if parts:
        return parts
    return [category_text] if category_text else []


def yaml_scalar(value):
    """尽量输出不带引号的标量, 含特殊字符时用双引号"""
    text = str(value)
    if re.search(r'''[:#\[\]{}",&*!|>'"%@`]''', text) or text.strip() != text:
        return '"%s"' % text.replace('"', '\\"')
    return text


def apply_front_matter_defaults(fm_lines, dst_path):
    """补默认分类 + 追加 --extend-frontmatter 字段 (对齐原 setFrontmatter.js)"""
    out = list(fm_lines)
    keys = _top_keys(out)

    if SITE_PARAMS.get('category', True) is not False and 'categories' not in keys:
        if is_article_front_matter(out, dst_path):
            cats = categories_for(dst_path, SITE_PARAMS.get('categorytext') or '随笔')
            cats = [c for c in cats if c]
            if cats:
                out.append('categories:')
                for c in cats:
                    out.append('  - %s' % yaml_scalar(c))
                stats['default_categories'] += 1

    for key, lines in EXTEND_FM.items():
        if key in keys:
            continue
        out.extend(lines)
        stats['extend_keys'] += 1
    return out


def transform_front_matter(fm_lines, weight, extra=None, drop_keys=()):
    """逐行改写 front matter, 尽量保留原有字段和顺序"""
    out = []
    i = 0
    has_weight = False
    seen = set()
    while i < len(fm_lines):
        line = fm_lines[i]
        raw = line.strip()

        if re.match(r'^-(?:\s*null)?\s*$', raw):
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
    # 7. 残留的 Vue 组件标签 -> Hugo 短代码
    body2 = convert_code_components(body2)
    body2 = strip_duplicate_h1(fm2, body2)
    # 8. 默认分类 / 扩展 frontmatter
    fm2 = apply_front_matter_defaults(fm2, dst)
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
    global SITE_PARAMS, EXTEND_FM, DST_ROOT

    ap = argparse.ArgumentParser()
    ap.add_argument('--src', default='legacy/docs')
    ap.add_argument('--dst', default='content')
    ap.add_argument('--config', default='hugo.toml',
                    help='读取 [params].categoryText / category / tag 的站点配置文件')
    ap.add_argument('--category-text', default=None,
                    help='碎片化文章(无分类子目录)的默认分类; 默认取 hugo.toml params.categoryText')
    ap.add_argument('--extend-frontmatter', default='',
                    help='追加到生成 frontmatter 的扩展字段 (YAML 片段, 原 themeConfig.extendFrontmatter)')
    ap.add_argument('--static-dir', default='static',
                    help='docs/.vuepress/public 的复制目标 (默认 static)')
    args = ap.parse_args()

    SITE_PARAMS = load_site_params(args.config)
    if args.category_text is not None:
        SITE_PARAMS['categorytext'] = args.category_text
    EXTEND_FM = parse_extend_frontmatter(args.extend_frontmatter)

    src_root = os.path.abspath(args.src)
    dst_root = os.path.abspath(args.dst)
    DST_ROOT = dst_root
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
        static_root = os.path.abspath(args.static_dir)
        shutil.copytree(pub, static_root, dirs_exist_ok=True)

    # ---- 报告 ----
    print('migrated pages : %d' % stats['pages'])
    print('containers     : %d' % stats['containers'])
    print('code-group converted : %d, code-block converted : %d'
          % (stats['code_groups'], stats['code_blocks']))
    print('default categories added : %d' % stats['default_categories'])
    print('extend frontmatter fields : %d' % stats['extend_keys'])
    print('categoryText     : %s' % (SITE_PARAMS.get('categorytext') or '随笔'))
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
