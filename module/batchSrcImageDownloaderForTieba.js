// ==UserScript==
// @name        批量下载贴吧原图
// @name:zh     批量下载贴吧原图
// @name:en     Batch srcImage downloader for tieba
// @version     2.5
// @description   一键打包下载贴吧中一页的原图
// @description:zh  一键打包下载贴吧中一页的原图
// @description:en  Batch Download Src Image From Baidu Tieba
// @supportURL  https://imcoder.site/a/detail/HuXBzyC
// @match       http://tieba.baidu.com/*
// @match       https://tieba.baidu.com/*
// @match       http://imgsrc.baidu.com/*
// @match       https://imgsrc.baidu.com/*
// @grant       GM_xmlHttpRequest
// @grant       GM.xmlHttpRequest
// @grant       GM_notification
// @require 	https://code.jquery.com/jquery-latest.min.js
// @require 	https://cdn.bootcss.com/toastr.js/2.1.3/toastr.min.js
// @require 	https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @author      Jeffrey.Deng
// @namespace https://greasyfork.org/users/129338
// ==/UserScript==

// @weibo       http://weibo.com/3983281402
// @blog        https://imcoder.site
// @date        2017.6.3

// @更新日志
// V 2.5        2019.12.2      1.修改为toastr提示方式
//                             2.采用队列下载
// V 2.4        2019.3.17      1.调整图片排序的命名，格式化数字（1显示为01），便于查看时顺序一样
//                             2.edge会闪退，原因不知，未修复
// V 2.3        2018.5.31      1.兼容edge
// V 2.2        2018.4.7       1.调整匹配图片策略
// V 2.1        2018.4.2       1.调用Tampermonkey API 实现跨域下载，无需修改启动参数
// V 2.0        2018.4.1       1.压缩包内增加贴子地址txt
//                             2.修复https不能下载
// V 1.9        2018.4.1       1.新增打包下载,图片重命名（需开启浏览器跨域）
// V 1.8        2018.3.31      1.修复BUG
//                             2.可自定义输入文件名后缀
// V 1.7        2017.6.9       1.修复魅族等贴吧下载图标不显示的问题
// V 1.6        2017.6.5       1.提高下载的图片正确率
// V 1.5        2017.6.4       1.增加右键新标签打开图片直接打开原图
// V 1.4        2017.6.3       1.更新对 https 的支持
//                             2.提高图片匹配成功率

(function (document, $) {

    $("head").append('<link rel="stylesheet" href="https://cdn.bootcss.com/toastr.js/2.1.3/toastr.min.css">');

    var common_utils = (function(document, $) {
        function parseURL(url) {
            var a = document.createElement('a');
            a.href = url;
            return {
                source: url,
                protocol: a.protocol.replace(':', ''),
                host: a.hostname,
                port: a.port,
                query: a.search,
                params: (function () {
                    var ret = {},
                        seg = a.search.replace(/^\?/, '').split('&'),
                        len = seg.length, i = 0, s;
                    for (; i < len; i++) {
                        if (!seg[i]) {
                            continue;
                        }
                        s = seg[i].split('=');
                        ret[s[0]] = s[1];
                    }
                    return ret;
                })(),
                file: (a.pathname.match(/\/([^\/?#]+)$/i) || [, ''])[1],
                hash: a.hash.replace('#', ''),
                path: a.pathname.replace(/^([^\/])/, '/$1'),
                relative: (a.href.match(/tps?:\/\/[^\/]+(.+)/) || [, ''])[1],
                segments: a.pathname.replace(/^\//, '').split('/')
            };
        }
        function ajaxDownload(url, callback, args) {
            var GM_download = GM.xmlHttpRequest || GM_xmlHttpRequest;
            GM_download({
                method: 'GET',
                responseType: 'blob',
                url: url,
                onreadystatechange: function(responseDetails) {
                    if (responseDetails.readyState === 4) {
                        if (responseDetails.status === 200 || responseDetails.status === 0) {
                            callback(responseDetails.response, args);
                        } else {
                            callback(null, args);
                        }
                    }
                },
                onerror: function(responseDetails) {
                    callback(null, args);
                    console.log(responseDetails.status);
                }
            });
            /*try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = "blob";
                xhr.onreadystatechange = function(evt) {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200 || xhr.status === 0) {
                            callback(xhr.response, args);
                        } else {
                            callback(null, args);
                        }
                    }
                };
                xhr.send();
            } catch (e) {
                callback(null, args);
            }*/
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
            if ('msSaveOrOpenBlob' in navigator) {
                navigator.msSaveOrOpenBlob(content, fileName);
            } else {
                var aLink = document.createElement('a');
                aLink.download = fileName;
                aLink.style = "display:none;";
                var blob = new Blob([content]);
                aLink.href = window.URL.createObjectURL(blob);
                document.body.appendChild(aLink);
                if (document.all) {
                    aLink.click(); //IE
                } else {
                    var evt = document.createEvent("MouseEvents");
                    evt.initEvent("click", true, true);
                    aLink.dispatchEvent(evt); // 其它浏览器
                }
                window.URL.revokeObjectURL(aLink.href);
                document.body.removeChild(aLink);
            }
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
        function paddingZero(num, length) {
            return (Array(length).join("0") + num).substr(-length);
        }
        /*  Class: TaskQueue
         *  Constructor: handler
         *      takes a function which will be the task handler to be called,
         *      handler should return Deferred object(not Promise), if not it will run immediately;
         *  methods: append
         *      appends a task to the Queue. Queue will only call a task when the previous task has finished
         */
        var TaskQueue = function (handler) {
            var tasks = [];
            // empty resolved deferred object
            var deferred = $.when();

            // handle the next object
            function handleNextTask() {
                // if the current deferred task has resolved and there are more tasks
                if (deferred.state() == "resolved" && tasks.length > 0) {
                    // grab a task
                    var task = tasks.shift();
                    // set the deferred to be deferred returned from the handler
                    deferred = handler(task);
                    // if its not a deferred object then set it to be an empty deferred object
                    if (!(deferred && deferred.promise)) {
                        deferred = $.when();
                    }
                    // if we have tasks left then handle the next one when the current one
                    // is done.
                    if (tasks.length >= 0) {
                        deferred.fail(function () {
                            tasks = [];
                            return;
                        });
                        deferred.done(handleNextTask);
                    }
                }
            }

            // appends a task.
            this.append = function (task) {
                // add to the array
                tasks.push(task);
                // handle the next task
                handleNextTask();
            };
        };
        var context = {
            "ajaxDownload": ajaxDownload,
            "fileNameFromHeader": fileNameFromHeader,
            "downloadBlobFile": downloadBlobFile,
            "downloadUrlFile": downloadUrlFile,
            "parseURL": parseURL,
            "paddingZero": paddingZero,
            "TaskQueue": TaskQueue
        };
        return context;
    })(document, jQuery);

    var options = {
        "type": 2,
        "isNeedConfirmDownload": true,
        "useQueueDownloadThreshold": 0,
        "suffix": null,
        "callback": {
            "parseLocationInfo_callback": function (location_info, options) {
                return common_utils.parseURL(document.location.href);
            },
            "parseFiles_callback": function (location_info, options) {
                // file.url file.folder_sort_index
                // not folder_sort_index -> use fileName
                var files = [];
                return files;
            },
            "makeNames_callback": function (arr, location_info, options) {
                var names = {};
                var time = new Date().getTime();
                names.zipName = "pack_" + time;
                names.folderName = names.zipName;
                names.infoName = null;
                names.infoValue = null;
                names.prefix = time;
                names.suffix = options.suffix;
                return names;
            },
            "beforeFileDownload_callback": function (files, names, location_info, options, zip, main_folder) {
            },
            "eachFileOnload_callback": function (blob, file, location_info, options, zipFileLength, zip, main_folder, folder) {
            },
            "allFilesOnload_callback": function (files, names, location_info, options, zip, main_folder) {
            },
            "beforeZipFileDownload_callback": function (zip_blob, files, names, location_info, options, zip, main_folder) {
                common_utils.downloadBlobFile(zip_blob, names.zipName + ".zip");
            }
        }
    };

    var ajaxDownloadAndZipFiles = function (files, names, location_info, options) {
        // GM_notification("开始下载～", names.zipName);
        var notify_start = toastr.success("正在打包～", names.zipName, {
            "progressBar": false,
            "hideDuration": 0,
            "showDuration": 0,
            "timeOut": 0,
            "closeButton": false
        });
        if (files && files.length > 0) {
            var zip = new JSZip();
            var main_folder = zip.folder(names.folderName);
            var zipFileLength = 0;
            var maxIndex = files.length;
            if (names.infoName) {
                main_folder.file(names.infoName, names.infoValue);
            }
            options.callback.beforeFileDownload_callback(files, names, location_info, options, zip, main_folder);
            var downloadFile = function (file, resolveCallback) {
                common_utils.ajaxDownload(file.url, function (blob, file) {
                    var folder = file.location ? main_folder.folder(file.location) : main_folder;
                    var isSave = options.callback.eachFileOnload_callback(blob, file, location_info, options, zipFileLength, zip, main_folder, folder);
                    if (isSave != false) {
                        if (file.fileName) {
                            folder.file(file.fileName, blob);
                        } else {
                            var suffix = names.suffix || file.url.substring(file.url.lastIndexOf('.') + 1);
                            file.fileName = names.prefix + "_" + file.folder_sort_index + "." + suffix;
                            folder.file(file.fileName, blob);
                        }
                    }
                    zipFileLength++;
                    notify_start.find(".toast-message").text("正在打包～ 第 " + zipFileLength + " 张");
                    resolveCallback && resolveCallback();   // resolve延迟对象
                    if (zipFileLength >= maxIndex) {
                        options.callback.allFilesOnload_callback(files, names, location_info, options, zip, main_folder);
                        zip.generateAsync({type: "blob"}).then(function (content) {
                            options.callback.beforeZipFileDownload_callback(content, files, names, location_info, options, zip, main_folder);
                        });
                        // GM_notification({text: "打包下载完成！", title: names.zipName, highlight : true});
                        notify_start.css("display", "none").remove();
                        toastr.success("下载完成！", names.zipName, {"progressBar": false, timeOut: 0});
                    }
                }, file);
            };
            if (maxIndex < options.useQueueDownloadThreshold) {
                // 并发数在useQueueDownloadThreshold内，直接下载
                for (var i = 0; i < maxIndex; i++) {
                    downloadFile(files[i]);
                }
            } else {
                // 并发数在useQueueDownloadThreshold之上，采用队列下载
                var queue = new common_utils.TaskQueue(function (file) {
                    if (file) {
                        var dfd = $.Deferred();
                        downloadFile(file, function () {
                            dfd.resolve();
                        });
                        return dfd;
                    }
                });
                for (var j = 0; j < maxIndex; j++) {
                    queue.append(files[j]);
                }
            }
        } else {
            toastr.remove(notify_start, true);
            toastr.error("未解析到图片！", "错误", {"progressBar": false});
        }
    };

    /** 批量下载 **/
    function batchDownload(config) {
        try {
            options = $.extend(true, options, config);
            var location_info = options.callback.parseLocationInfo_callback(options);
            var files = options.callback.parseFiles_callback(location_info, options);

            if (files && files.length > 0) {
                if (options.isNeedConfirmDownload && confirm("是否下载 " + files.length + " 张图片")) {
                    if (options.type == 1) {
                        urlDownload(files, names, location_info, options);
                    } else {
                        var names = options.callback.makeNames_callback(files, location_info, options);
                        ajaxDownloadAndZipFiles(files, names, location_info, options);
                    }
                }
            } else {
                toastr.error("未找到图片~", "");
            }
        } catch (e) {
            // GM_notification("批量下载照片 出现错误！", "");
            console.warn("批量下载照片 出现错误！, exception: ", e);
            toastr.error("批量下载照片 出现错误！", "");
        }

    }

    /** 下载 **/
    function urlDownload(photos, names, location_info, options) {
        GM_notification("开始下载～", names.zipName);
        var index = 0;
        var interval = setInterval(function () {
            if (index < photos.length) {
                var url = photos[index].url;
                var fileName = null;
                if (!names.suffix) {
                    fileName = names.prefix + "_" + (index + 1) + url.substring(url.lastIndexOf('.'));
                } else {
                    fileName = names.prefix + "_" + (index + 1) + "." + names.suffix;
                }
                common_utils.downloadUrlFile(url, fileName);
            } else {
                clearInterval(interval);
                return;
            }
            index++;
        }, 100);
    }

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

    //右键新标签打开图片直接打开原图
    initRightClickOpenSource();

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
          unsafeWindow.tiebaImagesDownload();
    });

    unsafeWindow.tiebaImagesDownload = function (options) {
        var config = {
            "type": 2,
            "minWidth": 100,
            "suffix": null,
            "source_host": (document.location.href.indexOf("https") == -1 ? "http" : "https") + "://imgsrc.baidu.com/forum/pic/item/",
            "callback": {
                "parseFiles_callback": function (location_info, options) {
                    var photo_arr = [];
                    var part_nodes_one = $('.d_post_content,.d_post_content_main').find("img");
                    //var part_nodes_two = $('.d_post_content_main,.post_bubble_middle,.d_post_content').find("img");
                    $.each(part_nodes_one, function(i, img){
                        // 如果是广告图片则跳过
                        if (img.parentNode.tagName == "A" && img.parentNode.className.indexOf("j_click_stats") != -1 ) {
                            return true;
                        }
                        if(img.clientWidth >= options.minWidth) {
                            if (img.className == "BDE_Image" || img.className == "d_content_img") {
                                var photo = {};
                                photo.location = "";
                                var thumb_url = img.src;
                                photo.folder_sort_index = photo_arr.length + 1;
                                // 如果是用户上传的图片
                                if (img.getAttribute("pic_type") == "0") {
                                    photo.url = options.source_host + thumb_url.substring(thumb_url.lastIndexOf('/') + 1);
                                }
                                // 如果是用户引用的图片
                                else {
                                    var m = thumb_url.match(/^(https?):\/\/(?:imgsrc|imgsa|\w+\.hiphotos)\.(?:bdimg|baidu)\.com\/(?:forum|album)\/.+\/(\w+\.(?:jpg|jpeg|gif|png|bmp|webp))(?:\?.+)?$/i);
                                    // 如果引用的是贴吧图片
                                    if (m !== null) {
                                        photo.url = options.source_host + m[2];
                                    } else {
                                        photo.url = thumb_url;
                                    }
                                }
                                photo.location = "photos";
                                photo_arr.push(photo);
                            }
                        }
                    });
                    return photo_arr;
                },
                "makeNames_callback": function (photos, location_info, options) {
                    var names = {};
                    var tie_id = location_info.file;
                    var pn = location_info.params.pn || 1;
                    var title = $(".core_title_txt").attr("title");
                    names.infoName = "tie_info.txt";
                    names.infoValue = "id：" + tie_id + "\r\n" +
                        "title：" + title + "\r\n" +
                        "url：" + location_info.source + "\r\n" +
                        "page：" + pn + "\r\n" +
                        "image_amount：" + photos.length + "\r\n";
                    names.zipName = "tie_" + tie_id + (pn == 1 ? "" : ("_" + pn));
                    names.folderName = names.zipName;
                    names.prefix = tie_id + "_" + common_utils.paddingZero(pn, 3);
                    names.suffix = options.suffix;
                    return names;
                },
                "beforeFileDownload_callback": function(photos, names, location_info, options, zip, main_folder) {
                    var photo_urls_str = "";
                    var paddingZeroLength = (photos.length + "").length;
                    $.each(photos, function(i, photo){
                        var photoDefaultName = names.prefix + "_" + common_utils.paddingZero(photo.folder_sort_index, paddingZeroLength) + "." + (names.suffix || photo.url.substring(photo.url.lastIndexOf('.') + 1));
                        var line = ((photo.location ? (photo.location + "/") : "" ) + photoDefaultName) + "\t" + photo.url + "\r\n";
                        photo_urls_str += line;
                    });
                    main_folder.file("photo_url_list.txt", photo_urls_str);
                },
                "eachFileOnload_callback": function(blob, photo, location_info, options, zipFileLength, zip, main_folder, folder) {
                    if (blob == null) {
                        if (!options.failFiles) {
                            options.failFiles = [];
                        }
                        options.failFiles.push(photo);
                    }
                    return true;
                },
                "allFilesOnload_callback": function (photos, names, location_info, options, zip, main_folder) {
                    if (options.failFiles && options.failFiles.length > 0) {
                        toastr.error("共 " + options.failFiles.length + " 张图片下载失败，已记录在photos_fail_list.txt！", "", {"progressBar": false, timeOut: 0});
                        var failPhotoListStr = "";
                        for (var i in options.failFiles) {
                            var failFile = options.failFiles[i];
                            failPhotoListStr += (failFile.location + "/" + failFile.fileName + "\t" + failFile.url + "\r\n");
                        }
                        main_folder.file("photos_fail_list.txt", failPhotoListStr);
                    }
                }
            }
        };
        if (options) {
            $.extend(true, config , options);
        }
        batchDownload(config);
    };

})(document, jQuery);