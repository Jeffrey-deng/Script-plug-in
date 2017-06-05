// ==UserScript==
// @name        批量下载贴吧原图
// @name:zh     批量下载贴吧原图
// @name:en     Batch srcImage downloader for tieba
// @version     1.9
// @description   一键批量下载贴吧中一页的原图
// @description:zh  一键批量下载贴吧中一页的原图
// @description:en  Batch Download Src Image From Baidu Tieba
// @supportURL  http://imcoder.site/article.do?method=detail&aid=124
// @match       http://tieba.baidu.com/*
// @match       https://tieba.baidu.com/*
// @match       http://imgsrc.baidu.com/*
// @match       https://imgsrc.baidu.com/*
// @require 	http://code.jquery.com/jquery-latest.js
// @require 	https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @author      Jeffrey.Deng
// @namespace https://greasyfork.org/users/129338
// ==/UserScript==

// @weibo       http://weibo.com/3983281402
// @blog        http://imcoder.site
// @date        2017.6.3

// @更新日志
// V 1.9        2018.4.1      1.新增打包下载,图片重命名（需开启浏览器跨域）
// V 1.8        2018.3.31      1.修复BUG
//                             2.可自定义输入文件名后缀
// V 1.7        2017.6.9       1.修复魅族等贴吧下载图标不显示的问题
// V 1.6        2017.6.5       1.提高下载的图片正确率
// V 1.5        2017.6.4       1.增加右键新标签打开图片直接打开原图
// V 1.4        2017.6.3       1.更新对 https 的支持
//                             2.提高图片匹配成功率

(function (document, $) {

    //右键新标签打开图片直接打开原图
    initRightClickOpenSource();

    //下载图片的过滤宽度
    var width = 100;
    var height = 100;
    var srchost = "http://imgsrc.baidu.com/forum/pic/item";

    var special_tieba_name = "";
    var is_special_tieba = false;

    var common_utils = (function(document, $) {
        function ajaxDownload(url, callback, args) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = "blob";
                xhr.onreadystatechange = function(evt) {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200 || xhr.status === 0) {
                            callback(xhr.response, args);
                        }
                    }
                };
                xhr.send();
            } catch (e) {
                callback(null, null);
            }
        }
        function fileNameFromHeader(disposition, url) {
            var result = null;
            if (disposition && /filename=.*/ig.test(disposition)) {
                result = disposition.match(/filename=.*/ig);
                return decodeURI(result[0].split("=")[1]);
            }
            return url.substring(url.lastIndexOf('/') + 1);
        }
        function downloadBlobFile(content, fileName) {
            //saveAs(content, fileName);
            var aLink = document.createElement('a');
            if (fileName) {
                aLink.download = fileName;
            } else {
                aLink.download = url.substring(url.lastIndexOf('/') + 1);
            }
            aLink.target = "_blank";
            aLink.style = "display:none;";
            var blob = new Blob([content]);
            aLink.href = URL.createObjectURL(blob);
            document.body.appendChild(aLink);
            if(document.all) {
                aLink.click(); //IE
            } else {
                var evt = document.createEvent("MouseEvents");
                evt.initEvent("click", true, true);
                aLink.dispatchEvent(evt ); // 其它浏览器
            }
            document.body.removeChild(aLink);
        }
        function downloadUrlFile(url, fileName) {
            var aLink = document.createElement('a');
            if (fileName) {
                aLink.download = fileName;
            } else {
                aLink.download = url.substring(url.lastIndexOf('/') + 1);
            }
            aLink.target = "_blank";
            aLink.style = "display:none;";
            aLink.href = url;
            document.body.appendChild(aLink);
            if(document.all) {
                aLink.click(); //IE
            } else {
                var evt = document.createEvent("MouseEvents");
                evt.initEvent("click", true, true);
                aLink.dispatchEvent(evt ); // 其它浏览器
            }
            document.body.removeChild(aLink);
        }
        var context = {
            "ajaxDownload": ajaxDownload,
            "fileNameFromHeader": fileNameFromHeader,
            "downloadBlobFile": downloadBlobFile,
            "downloadUrlFile": downloadUrlFile
        };
        return context;
    })(document, jQuery);

    function changeSuffix(arr) {
        var suffix = prompt("请输入你的想要的后缀：", "png");
        for (var i = 0; i < arr.length; i++) {
            arr[i] = arr[i].substring(0, arr[i].lastIndexOf('.') + 1) + suffix;
        }
        return suffix;
    }

    /** 批量下载 **/
    function batchDownload(type) {
        try {
            var arr = [];
            var postDiv_1 = $('.post_bubble_middle');
            var postDiv_2 = $('.d_post_content');
            var postDiv = $.merge(postDiv_1, postDiv_2);

            $(postDiv).find('img').each(function (i, img) {
                var url = $(img).attr('src');
                var m = null;
                var srcUrl = "";
                if ($(img).width() < width) {
                    return true;
                } else if ($(img).attr('class') === 'BDE_Image' && $(img).attr('pic_type') === "0") {
                    var filename = url.substring(url.lastIndexOf('/'));
                    arr.push(srchost + filename);
                } else if ((m = url.match(/^(https?):\/\/(?:imgsrc|imgsa|\w+\.hiphotos)\.(?:bdimg|baidu)\.com\/(?:forum|album)\/.+\/(\w+\.(?:jpg|jpeg|gif|png|bmp|webp))(?:\?.+)?$/i))) {
                    //pic_type这时失效了，所以要正则判断地址是否为用户上传图片地址格式
                    arr.push(srchost + "/" + m[2]);
                }
            });

            if (arr.length === 0) {
                if (confirm("未检测到图片，是否切换匹配方式查找")) {
                    var postDiv_3 = $('.d_post_content_main');
                    var postDiv_Max = $.merge(postDiv, postDiv_3);
                    $(postDiv_Max).find('img').each(function (i, img) {
                        var m = $(img).attr('src').match(/^(https?):\/\/(?:imgsrc|imgsa|\w+\.hiphotos)\.(?:bdimg|baidu)\.com\/(?:forum|album)\/.+\/(\w+\.(?:jpg|jpeg|gif|png|bmp|webp))(?:\?.+)?$/i);
                        if ($(img).attr('class') === 'BDE_Image' && $(img).width() >= width && m !== null) {
                            var srcUrl = srchost + "/" + m[2];
                            arr.push(srcUrl);
                        }
                    });
                }
            }

            if (confirm("是否下载 " + arr.length + " 张图片")) {
                var suffix = null;
                if (is_special_tieba) {
                    suffix = changeSuffix(arr);
                }
                var location_url = document.location.href.replace("#", "");
                var start = location_url.lastIndexOf("/") + 1;
                var end = location_url.lastIndexOf("?");
                var tie_id = (end != -1 ?  location_url.substring(start, end) : location_url.substring(start));
                if (type == 1) {
                    download(arr,tie_id, suffix);
                } else {
                    zipPhotosAndDownload(arr, tie_id, suffix);
                }
            }
        } catch (e) {
            console.log("批量下载贴吧原图 出现错误！");
        }

    }

    /** 下载 **/
    function download(arr, tie_id, suffix) {
        var prefix = tie_id;
        var index =  0;
        var interval = setInterval(function () {
            if (index <  arr.length) {
                if (!suffix) {
                    suffix = url.substring(url.lastIndexOf('.') + 1);
                }
                var fileName = prefix + "_" + (index + 1) + "." + suffix;
                common_utils.downloadUrlFile(arr[index], fileName);
            } else {
                clearInterval(interval);
                return;
            }
            index++;
        }, 100);
    }

    var zipPhotosAndDownload = function (arr, tie_id, suffix) {
        if (arr && arr.length > 0) {
            var zip = new JSZip();
            var zipFileName = "zip_" + tie_id;
            var folder = zip.folder(zipFileName);
            var zipLength = 0;
            var prefix = tie_id;
            for (var i = 0, maxIndex = arr.length; i < maxIndex; i++) {
                common_utils.ajaxDownload(arr[i], function (blob, url) {
                    suffix = suffix || url.substring(url.lastIndexOf('.') + 1);
                    var photoName = prefix + "_" + (zipLength + 1) + "." + suffix;
                    folder.file(photoName, blob);
                    zipLength++;
                    if (zipLength >= maxIndex) {
                        zip.generateAsync({type: "blob"}).then(function (content) {
                            common_utils.downloadBlobFile(content, zipFileName + ".zip");
                        });
                        alert("下载完成！");
                    }
                }, arr[i]);
            }
        }
    };

    //右键新标签打开图片直接打开原图
    function initRightClickOpenSource() {
        var url = document.location.toString();
        var m = null;
        if (!(m = url.match(/^https?:\/\/imgsrc\.baidu\.com\/forum\/pic\/item\/.+/i))) {
            if ((m = url.match(/^(https?):\/\/(?:imgsrc|imgsa|\w+\.hiphotos)\.(?:bdimg|baidu)\.com\/(?:forum|album)\/.+\/(\w+\.(?:jpg|jpeg|gif|png|bmp|webp))(?:\?.+)?$/i))) {
                document.location = m[1] + "://imgsrc.baidu.com/forum/pic/item/" + m[2];
            }
        }
    }


    /*** start main ***/

    /*
      var tiebaname = $('.card_title_fname').html();
      if( tiebaname.indexOf(special_tieba_name) >= 0  ){
        is_special_tieba = true;
       }
    */
    is_special_tieba = true;

    var rightParent = null;
    var html = "";
    var liCount = $('ul', $('#tb_nav')).eq(0).find('li').length;
    var liArr = $('ul', $('#tb_nav')).eq(0).find('li');
    var rightLi = liArr[liCount - 1];
    if ($(rightLi).hasClass('none_right_border')) {
        var tab = liArr[liCount - 2];
        var isStarTie = $(rightLi).hasClass("star_nav_tab");
        var rightHtml = "";
        if (isStarTie) {
            rightHtml = '<li class="star_nav_tab ">' + $(rightLi).html() + '</li>';
        } else {
            rightHtml = '<li class="j_tbnav_tab">' + $(rightLi).html() + '</li>';
        }
        $(tab).after(rightHtml);

        if (isStarTie) {
            html = '<div class="star_nav_tab_inner"><div class="space">' +
                '<a title="点击下载本页图片" class="star_nav_ico star_nav_ico_photo" id="batchDownloadBtn"><i class="icon"></i>下载</a></div></div>';
        } else {
            html = '<div class="tbnav_tab_inner"><p class="space">' +
                '<a  title="点击下载本页图片" class="nav_icon icon_jingpin  j_tbnav_tab_a" id="batchDownloadBtn"  location="tabplay" >下载</a>' +
                '</p></div>';
        }
        $(rightLi).html(html);
    } else {
        html = '<li class="j_tbnav_tab">' +
            '<a class=" j_tbnav_tab_a" id="batchDownloadBtn">下载</a> </li>';
        $(rightLi).after(html);
    }

    $('#batchDownloadBtn').click(function () {
        var type=prompt("请输入下载方式： 1：兼容方式，2：zip打包下载（需浏览器开启跨域）","1");
        batchDownload(type);
    });

})(document, jQuery);
