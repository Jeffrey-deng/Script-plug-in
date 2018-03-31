# script
Script plug-in for Tampermonkey

----
#### V 2.0  &emsp;&emsp;  2018.4.1

 1.压缩包内增加贴子地址txt
 2.修复https不能下载
 
#### V 1.9  &emsp;&emsp;  2018.4.1

 1.新增打包下载（需开启浏览器跨域）
 2.图片重命名

#### V 1.8  &emsp;&emsp;  2018.3.31

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

由于一次性会下载很多图片，所以需要把浏览器的 下载前询问位置 关闭

每次只能下载一页

如果你需要设置图片的最小大小，可以修改脚本中的 width 变量

多页下载可以 尝试 点击只看楼主 在下载

----
“ 由于新版本chrome对跨域下载更加严格，使得下载文件变成了新标签打开 ” 

解决办法：

        方法A：使用edge或降低浏览器版本

        方法B：解除浏览器跨域限制，浏览器快捷方式添加启动参数  --args --disable-web-security --user-data-dir

                    操作详细看 ：https://blog.csdn.net/dearwind153/article/details/52235749

                    解除跨域限制后 才能使用打包下载
----

我的博客: http://imcoder.site

邮箱：chao.devin@gmail.com

微博：[独伫小桥风卷袖](http://weibo.com/u/3983281402 "独伫小桥风卷袖")
