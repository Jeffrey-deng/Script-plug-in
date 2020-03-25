// ==UserScript==
// @name        批量下载微博原图、视频、livephoto
// @name:zh     批量下载微博原图、视频、livephoto
// @name:en     Batch Download Src Image From Weibo Card
// @version     1.4
// @description   一键打包下载微博中一贴的原图、视频、livephoto
// @description:zh  一键打包下载微博中一贴的原图、视频、livephoto
// @description:en  Batch download weibo's source image
// @supportURL  https://imcoder.site/a/detail/HuXBzyC
// @match       https://weibo.com/*
// @match       http://*.sinaimg.cn/*
// @match       https://*.sinaimg.cn/*
// @match       http://*.sinaimg.com/*
// @match       https://*.sinaimg.com/*
// @grant       GM_xmlHttpRequest
// @grant       GM.xmlHttpRequest
// @grant       GM_notification
// @require     https://code.jquery.com/jquery-latest.min.js
// @require     https://cdn.bootcss.com/toastr.js/2.1.3/toastr.min.js
// @require     https://cdn.bootcss.com/jszip/3.1.5/jszip.min.js
// @author      Jeffrey.Deng
// @namespace https://greasyfork.org/users/129338
// ==/UserScript==

// @weibo       http://weibo.com/3983281402
// @blog        https://imcoder.site
// @date        2019.12.26

// @更新日志
// V 1.4        2020.03.26     1.支持只下载链接，按钮【打包下载】：下载文件和链接，【下载链接】：仅下载链接
// V 1.3        2020.01.26     1.修复bug
// V 1.0        2019.12.26     1.支持打包下载用户一次动态的所有原图
//                             2.支持下载18图
//                             3.支持下载livephoto
//                             4.支持下载视频
//                             5.支持下载微博故事
//                             6.右键图片新标签直接打开原图

(function (document, $) {

    $("head").append('<link rel="stylesheet" href="https://cdn.bootcss.com/toastr.js/2.1.3/toastr.min.css">');

    var common_utils = (function (document, $) {
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

        function ajaxDownload(url, callback, args, tryTimes) {
            tryTimes = tryTimes || 0;
            var GM_download = GM.xmlHttpRequest || GM_xmlHttpRequest;
            GM_download({
                method: 'GET',
                responseType: 'blob',
                url: url,
                onreadystatechange: function (responseDetails) {
                    if (responseDetails.readyState === 4) {
                        if (responseDetails.response != null && (responseDetails.status === 200 || responseDetails.status === 0)) {
                            callback(responseDetails.response, args);
                        } else {
                            if (tryTimes++ == 3) {
                                callback(null, args);
                            } else {
                                ajaxDownload(url, callback, args, tryTimes);
                            }
                        }
                    }
                },
                onerror: function (responseDetails) {
                    if (tryTimes++ == 3) {
                        callback(null, args);
                    } else {
                        ajaxDownload(url, callback, args, tryTimes);
                    }
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
            if (document.all) {
                aLink.click(); //IE
            } else {
                var evt = document.createEvent("MouseEvents");
                evt.initEvent("click", true, true);
                aLink.dispatchEvent(evt); // 其它浏览器
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
            "beforeFilesDownload_callback": function (files, names, location_info, options, zip, main_folder) {
            },
            "beforeFileDownload_callback": function (file, location_info, options, zipFileLength, zip, main_folder, folder) {
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
            var paddingZeroLength = (files.length + "").length;
            if (names.infoName) {
                main_folder.file(names.infoName, names.infoValue);
            }
            options.callback.beforeFilesDownload_callback(files, names, location_info, options, zip, main_folder);
            var downloadFile = function (file, resolveCallback) {
                return $.Deferred(function(dfd) {
                    var folder = file.location ? main_folder.folder(file.location) : main_folder;
                    var isSave = options.callback.beforeFileDownload_callback(file, location_info, options, zipFileLength, zip, main_folder, folder);
                    if (isSave != false) {
                        common_utils.ajaxDownload(file.url, function (blob, file) {
                            var isSave = options.callback.eachFileOnload_callback(blob, file, location_info, options, zipFileLength, zip, main_folder, folder);
                            if (isSave != false) {
                                if (file.fileName) {
                                    folder.file(file.fileName, blob);
                                } else {
                                    var suffix = names.suffix || file.url.substring(file.url.lastIndexOf('.') + 1);
                                    file.fileName = names.prefix + "_" + common_utils.paddingZero(file.folder_sort_index, paddingZeroLength) + "." + suffix;
                                    folder.file(file.fileName, blob);
                                }
                            }
                            dfd.resolveWith(file, [blob, folder, isSave]);
                        }, file);
                    } else {
                        dfd.resolveWith(file, [null, folder, false]);
                    }
                }).then(function(blob, folder, isSave){
                    zipFileLength++;
                    notify_start.find(".toast-message").text("正在打包～ 第 " + zipFileLength + " 张" + (isSave ? "" : "跳过"));
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
                });
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
            if (!(files && files.promise)) {
                files = $.when(files);
            }
            files.done(function (files) {
                if (files && files.length > 0) {
                    if (!options.isNeedConfirmDownload || confirm("是否下载 " + files.length + " 张图片")) {
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
            });
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
        var m;
        if ((m = url.match(/^(https?:\/\/(?:(?:ww|wx|ws|tvax|tva)\d+|wxt|wt)\.sinaimg\.(?:cn|com)\/)([\w\.]+)(\/.+)(?:\?.+)?$/i))) {
            if (m[2] != "large") {
                document.location = m[1] + "large" + m[3];
            }
        }
    }

    /*** start main ***/

    //右键新标签打开图片直接打开原图
    initRightClickOpenSource();

    var addDownloadBtnToWeiboCard = function ($wb_card) {
        var $card_btn_list = $wb_card.find(".WB_feed_detail .WB_screen .layer_menu_list ul:nth-child(1)");
        if ($card_btn_list.find(".WB_card_photos_download").length == 0) {
            $card_btn_list.append('<li class="WB_card_photos_download"><a>打包下载</a></li>');
            $card_btn_list.append('<li class="WB_card_photos_download WB_card_photos_download_only_url"><a>下载链接</a></li>');
        }
    };

    $("body").on("click", ".WB_cardwrap .WB_screen .ficon_arrow_down", function () {
        addDownloadBtnToWeiboCard($(this).closest(".WB_cardwrap"));
    });
    $("body").on("click", ".WB_cardwrap .WB_screen .layer_menu_list .WB_card_photos_download", function () {
        var $self = $(this);
        unsafeWindow.downloadWeiboCardPhotos($self.closest(".WB_cardwrap"), {"only_download_url": $self.hasClass('WB_card_photos_download_only_url')});
    });

    unsafeWindow.downloadWeiboCardPhotos = function (wb_card_node, options) {
        var $wb_card = $(wb_card_node);
        var config = {
            "$wb_card": $wb_card,
            "type": 2,
            "only_download_url": false, // 是否仅下载链接，true: 只下链接，false：下载文件和链接
            "suffix": null,
            "callback": {
                "parseFiles_callback": function (location_info, options) {
                    var $wb_detail = $wb_card.find(".WB_feed_detail .WB_detail");
                    var photo_parse_index = 0;
                    var video_parse_index = 0;
                    var photo_arr = [];
                    // 视频
                    var $wb_video = $wb_detail.find(".WB_media_wrap .media_box .WB_video");
                    if ($wb_video.length != 0) {
                        var feedVideo = {};
                        var feedVideoCoverImg = {};
                        var video_data_str = $wb_video.attr("action-data");
                        var isFeedVideo = video_data_str.match(/&?type=feedvideo\b/) ? true : false;
                        if (isFeedVideo) {
                            feedVideo.url = decodeURIComponent(video_data_str.match(/&video_src=([^&]+)/)[1]);
                            feedVideo.url.indexOf("//") == 0 && (feedVideo.url = "https:" + feedVideo.url);
                            feedVideo.fileName = feedVideo.url.match(/\/([^/?]+(\.mp4)?)\?/)[1] + (RegExp.$2 ? "" : ".mp4");;
                            feedVideo.folder_sort_index = ++video_parse_index;
                            feedVideo.location = "videos";
                            feedVideoCoverImg.url = decodeURIComponent(video_data_str.match(/&cover_img=([^&]+)/)[1]);
                            feedVideoCoverImg.fileName = feedVideoCoverImg.url.match(/\/([^/]+)$/)[1];
                            if (feedVideoCoverImg.url.indexOf("miaopai.com") != -1 || feedVideoCoverImg.url.indexOf("youku.com") != -1 ) {
                                feedVideoCoverImg.url = feedVideoCoverImg.url;
                                feedVideoCoverImg.url.indexOf("//") == 0 && (feedVideoCoverImg.url = "https:" + feedVideoCoverImg.url);
                            } else {
                                feedVideoCoverImg.url = "https://wx3.sinaimg.cn/large/" + feedVideoCoverImg.fileName;
                            }
                            feedVideoCoverImg.folder_sort_index = ++photo_parse_index;
                            feedVideoCoverImg.location = "photos";
                            photo_arr.push(feedVideo);
                            photo_arr.push(feedVideoCoverImg);
                        }
                        var video_sources_str = $wb_video.attr("video-sources");
                        if (video_sources_str) {
                            // 取清晰度最高的
                            var video_source_list = video_sources_str.split("&").filter(function (line) {
                                return /^\d+=.+/.test(line);
                            }).sort(function (a, b) {
                                return parseInt(a.match(/^(\d+)=/)[1]) < parseInt(b.match(/^(\d+)=/)[1]) ? 1 : -1;
                            }).map(function (url) {
                                return decodeURIComponent(url.replace(/^\d+=/, ""));
                            });
                            if (video_source_list.length > 0) {
                                feedVideo.url = video_source_list[0];
                                feedVideo.fileName = feedVideo.url.match(/\/([^/?]+(\.mp4)?)\?/)[1] + (RegExp.$2 ? "" : ".mp4");
                            }
                        }
                    }
                    // 微博故事
                    var $wb_story = $wb_detail.find(".WB_media_wrap .media_box .li_story");
                    if ($wb_story.length != 0) {
                        var weiboStoryVideo = {};
                        var weibo_story_data_str = $wb_story.attr("action-data");
                        if (/&gif_ourl=([^&]+)/.test(weibo_story_data_str)) {
                            weiboStoryVideo.url = decodeURIComponent(RegExp.$1);
                        } else if (/&gif_url=([^&]+)/.test(weibo_story_data_str)) {
                            weiboStoryVideo.url = decodeURIComponent(RegExp.$1);
                        }
                        if (weiboStoryVideo.url) {
                            weiboStoryVideo.fileName = weiboStoryVideo.url.match(/\/([^/?]+(\.mp4)?)\?/)[1] + (RegExp.$2 ? "" : ".mp4");
                            weiboStoryVideo.folder_sort_index = ++photo_parse_index;
                            weiboStoryVideo.location = "videos";
                            photo_arr.push(weiboStoryVideo);
                        }
                    }
                    // 照片
                    var pic_data_str = $wb_detail.find(".WB_media_wrap .media_box ul").attr("action-data");
                    var pic_ids_str_m = pic_data_str && pic_data_str.match(/&pic_ids=([^&]+)/);
                    if (pic_ids_str_m) {
                        // livephoto
                        var pic_video_ids = null;
                        var pic_video_ids_str_m = pic_data_str.match(/&pic_video=([^&]+)/);
                        if (pic_video_ids_str_m) {
                            pic_video_ids = pic_video_ids_str_m[1].split(",").map(function (pair) {
                                return pair.split(":")[1];
                            });
                        }
                        var pic_thumb_str = pic_data_str.match(/&thumb_picSrc=([^&]+)/) && RegExp.$1;
                        var parsePhotosFromIds = function (pic_ids, pic_video_ids) {
                            $.each(pic_ids, function (i, photo_id) {
                                var photo = {};
                                photo.photo_id = photo_id;
                                if (pic_thumb_str && pic_thumb_str.indexOf(photo_id + ".gif") != -1) {
                                    photo.url = "https://wx3.sinaimg.cn/large/" + photo_id + ".gif";
                                } else {
                                    photo.url = "https://wx3.sinaimg.cn/large/" + photo_id + ".jpg";
                                }
                                photo.folder_sort_index = ++photo_parse_index;
                                photo.location = "photos";
                                photo_arr.push(photo);
                            });
                            pic_video_ids && $.each(pic_video_ids, function (i, photo_video_id) {
                                var photo = {};
                                photo.video_id = photo_video_id;
                                photo.url = "https://video.weibo.com/media/play?livephoto=//us.sinaimg.cn/" + photo_video_id + ".mov&KID=unistore,videomovSrc";
                                photo.fileName = photo_video_id + ".mov";
                                photo.folder_sort_index = ++video_parse_index;
                                photo.location = "videos";
                                photo_arr.push(photo);
                            });
                        };
                        if (/over9pic=1&/.test(pic_data_str) && !/isloadedover9pids=1/.test(pic_data_str)) {
                            var deferred = $.Deferred();
                            var isForward = $wb_card.attr("isforward") == "1" ? true : false;
                            var mid;
                            if (!isForward) {
                                mid = $wb_card.attr("mid")
                            } else {
                                mid = $wb_card.find(".WB_feed_detail .WB_detail .WB_feed_expand .WB_expand .WB_handle").attr("mid");
                            }
                            $.get("https://weibo.com/aj/mblog/getover9pic", {
                                "ajwvr": 6,
                                "mid": mid,
                                "__rnd": new Date().getTime(),
                            }, function (response) {
                                parsePhotosFromIds(pic_ids_str_m[1].split(","), pic_video_ids);
                                parsePhotosFromIds(response.data);
                                deferred.resolve(photo_arr);
                            });
                            // $wb_detail.find(".WB_media_wrap .media_box ul .WB_pic .W_icon_tag_9p").trigger("click");
                            // setTimeout(function () {
                            //     parsePhotosFromIds($wb_detail.find(".WB_media_wrap .media_box ul").attr("action-data").match(/&pic_ids=([^&]+)&/)[1].split(","));
                            //     deferred.resolve(photo_arr);
                            // }, 1500);
                            return deferred; // 需要异步获取直接返回
                        } else {
                            parsePhotosFromIds(pic_ids_str_m[1].split(","), pic_video_ids);
                        }
                    } else {
                        var $wb_pics = $wb_detail.find(".WB_media_wrap .media_box ul .WB_pic img");
                        var regexp_search = /^(https?:\/\/(?:(?:ww|wx|ws|tvax|tva)\d+|wxt|wt)\.sinaimg\.(?:cn|com)\/)([\w\.]+)(\/.+)(?:\?.+)?$/i;
                        $.each($wb_pics, function (i, img) {
                            var photo = {};
                            var thumb_url = img.src;
                            photo.url = thumb_url;
                            var m = thumb_url.match(regexp_search);
                            if (m) {
                                if (m[2] != "large") {
                                    photo.url = m[1] + "large" + m[3];
                                }
                            }
                            photo.folder_sort_index = ++photo_parse_index;
                            photo.location = "photos";
                            photo_arr.push(photo);
                        });
                    }
                    return photo_arr;
                },
                "makeNames_callback": function (photos, location_info, options) {
                    var names = {};
                    var isForward = $wb_card.attr("isforward") == "1" ? true : false;   // 是否是转发
                    var users = [];
                    var cards = [];
                    names.infoName = "card_info.txt";
                    names.infoValue = "";
                    var findCardInfo = function ($wb_detail, isForward) {
                        var $user_home_link = $wb_detail.find(".W_fb").eq(0);
                        var $card_link = $wb_detail.find(".WB_from a").eq(0);
                        var user = {};
                        user.uid = $user_home_link.attr("usercard").match(/id=(\d+)/)[1];
                        user.nickname = $user_home_link.attr("nick-name") || $user_home_link.text();
                        user.home_link = $user_home_link.prop("href").replace(/\?.*/, "");
                        var card = {};
                        card.forward = isForward;
                        card.link = $card_link.prop("href").replace(/\?.*/, "");
                        card.id = card.link.match(/\d+\/([A-Za-z0-9]+)$/)[1];
                        card.mid = isForward ? $wb_detail.find(".WB_handle").attr("mid") : $wb_detail.closest(".WB_cardwrap").attr("mid");
                        card.date = $card_link.attr("title");
                        card.date_timestamp = $card_link.attr("date");
                        card.text = $wb_detail.find(".WB_text").eq(0).prop("innerText").replace(/[\u200b]+$/, "").replace(/^\s*|\s*$/g, "");
                        var textLines = card.text.split(/\s{4,}|\s*\n\s*/);
                        card.name = textLines[0];
                        if (card.name.length <= 5 && textLines.length > 1) {
                            card.name += textLines[1];
                        }
                        if (card.name.length > 30) {
                            card.name = card.name.substring(0, 30);
                        }
                        card.photo_count = photos.length;
                        if (!isForward) {
                            var tab_type_flag = $(".WB_main_c").find("div:nth-child(1)").attr("id");
                            if (tab_type_flag && /.*(favlistsearch|likelistoutbox)$/.test(tab_type_flag)) {
                                var $page_list = $(".WB_cardwrap .W_pages .layer_menu_list ul");
                                if ($page_list.length != 0) {
                                    var maxPage = parseInt($page_list.find("li:nth-child(1) > a").text().match(/第(\d+)页/)[1]);
                                    var currPage = parseInt($page_list.find(".cur > a").text().match(/第(\d+)页/)[1]);
                                    card.countdown_page = maxPage - currPage + 1;
                                }
                            }
                        }
                        names.infoValue += "-----------" + (isForward ? "forward card" : "card") + "--------------" + "\r\n";
                        $.each(card, function (key, value) {
                            names.infoValue += (isForward ? "forward_" : "") + "card_" + key + "：" + value + "\r\n";
                        });
                        names.infoValue += "-----------------------------------" + "\r\n";
                        $.each(user, function (key, value) {
                            names.infoValue += (isForward ? "forward_" : "") + "user_" + key + "：" + value + "\r\n";
                        });
                        names.infoValue += "-----------------------------------" + "\r\n";
                        users.push(user);
                        cards.push(card);
                    };
                    findCardInfo($wb_card.find(".WB_feed_detail .WB_detail"), false);   // 主贴的信息
                    if (isForward) {
                        // 转发的贴的信息
                        findCardInfo($wb_card.find(".WB_feed_detail .WB_detail .WB_feed_expand .WB_expand"), true);
                    }
                    names.zipName = users[0].nickname + "_" + users[0].uid + "_" + cards[0].id + "_" + (cards[0].name
                            .replace(/\.\./g, "")
                            .replace(/\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]/g, "").replace(/[\u200b]+$/, "")
                            .replace(/(^[_-]+)|([_-]+$)/g, "")
                            .replace(/(^\s+)|(\s+$)/g, ""));
                    names.folderName = names.zipName;
                    names.prefix = null;
                    names.suffix = options.suffix;
                    return names;
                },
                "beforeFilesDownload_callback": function (photos, names, location_info, options, zip, main_folder) {
                    var photo_urls_str = "";
                    $.each(photos, function (i, photo) {
                        if (!photo.fileName) {
                            photo.fileName = photo.url.substring(photo.url.lastIndexOf('/') + 1);
                        }
                        var line = ((photo.location ? (photo.location + "/") : "" ) + photo.fileName) + "\t" + photo.url + "\r\n";
                        photo_urls_str += line;
                    });
                    main_folder.file("photo_url_list.txt", photo_urls_str);
                    options.failFiles = undefined;
                },
                "beforeFileDownload_callback": function (file, location_info, options, zipFileLength, zip, main_folder, folder) {
                    if (options.only_download_url) {
                        return false;
                    } else {
                        return true;
                    }
                },
                "eachFileOnload_callback": function (blob, photo, location_info, options, zipFileLength, zip, main_folder, folder) {
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
                        toastr.error("共 " + options.failFiles.length + " 张下载失败，已记录在photos_fail_list.txt！", "", {
                            "progressBar": false,
                            timeOut: 0
                        });
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
            $.extend(true, config, options);
        }
        batchDownload(config);
    };

})(document, jQuery);