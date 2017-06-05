# script
Script plug-in for Tampermonkey

----
#### V 1.8  &emsp;&emsp;  2018.8.31

 1.修复BUG
 2.可自定义输入文件名后缀
 
#### V 1.7  &emsp;&emsp;  2017.6.9

 1.修复魅族等贴吧下载图标不显示的问题

#### V 1.6  &emsp;&emsp;  2017.6.5

 1.提高下载的图片正确率

#### V 1.5  &emsp;&emsp;  2017.6.4 

 1.增加右键新标签打开图片直接打开原图  

#### V 1.4  &emsp;&emsp; 2017.6.3 

 1.更新对 https 的支持  
 2.提高图片匹配成功率  
 
----

由于贴吧图片都是压缩的，右键原图下载又麻烦
就写了一个批量下载贴吧原图的JS脚本
需要配合chrome扩展 Tampermonkey 使用（firefox 为 油猴）
![Tampermonkey](https://github.com/Jeffrey-deng/script/blob/master/screenshots/Tampermonkey.png)

然后打开此链接到 greasyfork 安装

https://greasyfork.org/zh-CN/scripts/30307

打开后点击安装即可

![howuse](https://github.com/Jeffrey-deng/script/blob/master/screenshots/howuse.png)

## 使用：

由于js权限问题，现在不能一次性保存到某个文件夹，只能是全都下载到 下载文件夹 。

由于一次性会下载很多图片，所以需要把浏览器的 下载前询问位置 关闭

每次只能下载一页

如果你需要设置图片的最小大小，可以修改脚本中的 width 变量

----

我的博客: http://imcoder.site

邮箱：chao.devin@gmail.com

微博：[独伫小桥风卷袖](http://weibo.com/u/3983281402 "独伫小桥风卷袖")
