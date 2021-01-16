## Welcome to ASYS

You can use the [editor on GitHub](https://github.com/Liangchenxu/asys/edit/gh-pages/index.md) to maintain and preview the content for your website in Markdown files.

Whenever you commit to this repository, GitHub Pages will run [Jekyll](https://jekyllrb.com/) to rebuild the pages in your site, from the content in your Markdown files.

### Markdown

Markdown is a lightweight and easy-to-use syntax for styling your writing. It includes conventions for

```markdown
Syntax highlighted code block

# Header 1
## Header 2
### Header 3

- Bulleted
- List

1. Numbered
2. List

**Bold** and _Italic_ and `Code` text

[Link](url) and ![Image](src)
```

For more details see [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/).

### Jekyll Themes

Your Pages site will use the layout and styles from the Jekyll theme you have selected in your [repository settings](https://github.com/Liangchenxu/asys/settings). The name of this theme is saved in the Jekyll `_config.yml` configuration file.

### Support or Contact

Having trouble with Pages? Check out our [documentation](https://docs.github.com/categories/github-pages-basics/) or [contact support](https://support.github.com/contact) and we’ll help you sort it out.

<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=gb2312" />
<title>css+mootools.js插件写的蓝色二级导航菜单_网页代码站(www.webdm.cn)</title>
<style>
body {font-family:\5B8B\4F53,Arial Narrow,arial,serif;background:#ffffff;font-size:12px;}
body,div,dl,dt,dd,ul,ol,li,pre,form,fieldset,input,textarea,blockquote,emBED{padding:0; margin:0;}
ul,li{list-style: none;}
a {color: #17519c;}
a:hover {color: #ff0000;}
#rt-main-header{margin: 0 auto;width: 990px;}
.menu {width:990px;height:48px;float:left;background:url('/images/20150503/nav_bg.gif') repeat-x;color:#fff;}
.menutop {margin: 0;padding: 0;position: relative;float:left;height:48px;background:url('/images/20150503/nav_l_bg.gif') no-repeat;}
.menutop li {float:left;margin: 0;padding: 0;position: relative;line-height:48px; font-size:12px;background:url('/images/20150503/nav_li_right.gif') right no-repeat; text-align:center;}
.menutop li .item, .menutop li.active .item {display: block;margin: 0;text-decoration: none;float: none;padding:0;width:138px;}
.menutop li .fusion-submenu-wrapper {float: none;left: -999em;position: absolute;z-index: 500;}
.menu_right{padding-right:10px;background:url('/images/20150503/nav_r_bg.gif') no-repeat right top;float:right;height:48px;}
/* 下拉部分 */
.menutop ul {width:140px;padding:0;margin: 0;float:left;z-index: 2;}
.menutop ul li {width: 138px;height:39px;line-height:39px;background:url('/images/20150503/sublibg.gif') no-repeat;padding:0;}
.menutop ul li a:hover{width:138px;height:39px;line-height:39px;background:url('/images/20150503/sublihover.gif') no-repeat;padding:0; }
.menutop li > .item {padding: 0;height: auto;display: block;font-size:12px;line-height:39px;color:#fff; text-align:center;}
.menutop li > .item span {display: block;padding: 0;width: 100%;}
.menutop li a.item {cursor: pointer;padding:0;color:#fff;}
.menutop li span.item {cursor:default;outline:none; }
/* 主菜单选项 */
.menutop li.root :hover{float:left;background:url('/images/20150503/nav_hover.gif') no-repeat right top;}
body .menutop li.root > .item {white-space: nowrap;display: block;font-weight: bold;padding: 0;font-size: 12px;z-index: 100;cursor: pointer;position:relative;outline: none;text-align: center;line-height: 28px;background: none;}
.menutop li.root > .item span {display: block;margin: 0;outline: none;padding: 10px 0;}
/* Fusion Pill */
.fusion-pill-l {height: 60px;margin:0 0 0 -6px;top:0;position:absolute;left:0;}
.fusion-pill-r {height: 60px;}
/* Fusion JS */
.fusion-js-container {display:block;height:0;left:0;overflow:visible;position:absolute;top:0;z-index:50000!important;background:trans !important;}
.fusion-js-subs {display:none;margin:-3px 0 0;overflow:hidden;padding:0;position:absolute;}
</style>
<script type="text/javascript" src="/images/20150503/mootools.js"></script>
<script type="text/javascript" src="/images/20150503/fusion.js"></script>
<script type="text/javascript">
window.addEvent('load', function() {
new Fusion('ul.menutop', {
	pill: 1,
	effect: 'slide',
	opacity: 1,
	hideDelay: 500,
	centered: 0,
	tweakInitial: {'x': 0, 'y': -1},
   	tweakSubsequent: {'x': 1, 'y': -1},
	menuFx: {duration: 500, transition: Fx.Transitions.Back.easeInOut},
	pillFx: {duration: 250, transition: Fx.Transitions.linear}
});
});
</script>
</head>
<body>
<div id="rt-main-header">
<div class="menu">
   <ul class="menutop">
	 <li class="root"><a class="item " href="/"><span>网站首页</span></a>	</li>
	 <li class="root"><a class=" item " href="" ><span>网络营销</span></a>
	   <div class="fusion-submenu-wrapper ">
	     <ul>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
		 </ul>
      </div>
          </li>
	<li class="root" ><a class=" item " href=""><span>网站推广</span></a>
		<div class="fusion-submenu-wrapper ">
	         <ul >
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
			</ul>
       </div>
         </li>
	<li class="root" ><a class=" item " href=""  ><span>网站建设</span></a></li>
	<li class="root" ><a class=" item " href=""  ><span>源码下载</span></a>
		<div class="fusion-submenu-wrapper ">
	         <ul>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
			</ul>
       </div>
         </li>
   <li class="root" ><a class=" item " href=""  ><span>导航条代码</span></a>
		<div class="fusion-submenu-wrapper ">
	         <ul>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
			</ul>
       </div>
         </li>
   <li class="root" ><a class=" item " href=""  ><span>源码下载</span></a>
		<div class="fusion-submenu-wrapper ">
	         <ul>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
				<li><a class=" item " href=""><span>电子商务</span></a></li>
			</ul>
       </div>
    </li>
</ul>
<div class="menu_right"></div>
</div>
</div>
<div style="clear:both"></div>
<br>
<p><a href="http://www.webdm.cn">网页代码站</a> - 最专业的网页代码下载网站 - 致力为中国站长提供有质量的网页代码！</p>
</body>
</html>
