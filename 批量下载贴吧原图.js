// ==UserScript==
// @name        批量下载贴吧原图
// @name:zh     批量下载贴吧原图
// @name:en     Batch srcImage downloader for tieba
// @version     1.1
// @description   一键批量下载贴吧中一页的原图
// @description:zh  一键批量下载贴吧中一页的原图
// @description:en  Batch Download Src Image From Baidu Tieba
// @supportURL  http://imcoder.site
// @match       http://tieba.baidu.com/*
// @include     http://tieba.baidu.com/*
// @require 	http://code.jquery.com/jquery-latest.js
// @author      Jeffrey.Deng
// @namespace https://greasyfork.org/users/129338
// ==/UserScript==

var width = 100;
var height = 100;
var srchost = "https://imgsa.baidu.com/forum/pic/item";


(function(){
    var tab = $('#tb_nav').find('li')[  $('#tb_nav').find('li').length - 2 ];
    var rightParent = $('#j_navtab_game').parent().parent().parent();
    var rightHtml = '<li class=" j_tbnav_tab ">' + $(rightParent).html() + '</li>';
    $(tab).after(rightHtml);
    var html = '<li class=" j_tbnav_tab "><div class="tbnav_tab_inner"><p class="space">'+
			  '<a  class="nav_icon icon_jingpin  j_tbnav_tab_a" id="batchDownloadBtn"  location="tabplay" >下载</a>'+
		      '</p></div></li>';
    $(rightParent).html(html);
	$('#batchDownloadBtn').click(function(){
		batchDownload();
	});
})();

/** 批量下载 **/
function batchDownload(){
  try{
      var arr = [];
      var postDiv_1 =  $('.post_bubble_middle');
      var postDiv_2 =  $('.d_post_content');
      var postDiv = $.merge(postDiv_1,postDiv_2);

      $(postDiv).find('img').each(function(i,img){
          if( $(img).attr('class') === 'BDE_Image' && $(img).attr('pic_type')==="0" && $(img).width() >= width ){
              var url = $(img).attr('src');
              var filename = url.substring(url.lastIndexOf('/'));
              var srcUrl = srchost+filename;
              arr.push(srcUrl);
          }
      });
      
      if( confirm( "是否下载 " + arr.length +" 张图片" )   ){
         download(arr);
      }
  }catch(e){

  }

}

/** 下载 **/
function download(arr){
    arr.map(function(i){
        var a = document.createElement('a');
        a.setAttribute('download','');
        a.href=i;
        document.body.appendChild(a);
        a.click();
    });
}