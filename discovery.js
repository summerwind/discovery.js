/*
 * discovery.js v1.0
 * https://github.com/summerwind/discovery.js
 * Copyright 2010, Moto Ishizawa
 * Licensed under the MIT license.
 */

// コンストラクタ
// ----------------------------------------------
Discovery = function(wrapper) {
    // 要素がなければエラー
	if(!wrapper.size()) {
		this._error('Wrapper element was not found.');
	}
	
	// Wrapperを保存してCSSを追加
	this.wrapper = wrapper;
	// オーバーレイ用Canvasの生成
	this.canvas = this._createCanvas();
	// イベントハンドラプロパティを初期化
	this.handler = {};
	
	// デバッグモード
    this.debug = 0;
};


// 有効化メソッド
// ----------------------------------------------
Discovery.prototype.activate = function(args) {
    var d = this;
    
    // 引数がなかったらエラーとする
    if(!args || !args.video || !args.image || !args.meta) {
        this._error('Arguments error.');
        return 0;
    }
    
    // オーバーレイ遅延フレームの取得
    this.delay = args.delay || 0;
    
    // 読み込みフラグを初期化
    this.flag = {
        video: 0,
        image: 0,
        prerendering: 0
    };
    
    // メタデータの読み込み
    this.meta = this._loadMeta(args.meta);
    //　動画の読み込み
    this.video = this._loadVideo(args.video);
    // 画像の読み込み
    this.image = this._loadImage(args.image, function(){
        // プレレンダリングを実行
        d._prerendering();
    });
    
    // WrapperのCSSを変更
    this.wrapper.css({
	    position: "relative"
	});
	// CanvasのCSSを変更
	this.canvas.elem.attr({
	    width: $(this.video).width(),
	    height: $(this.video).height()
	})
	// WrapperにCanvasを追加
	this.wrapper.append(this.canvas.elem);
};


// 再生メソッド
// ----------------------------------------------
Discovery.prototype.play = function() {
    var d = this;
    
    // 読み込み完了判定
    if(!this.flag.image || !this.flag.prerendering) {
        // 未完了だったら500ms後に再実行
        setTimeout(function(){
            d.play();
        }, 500);
        return;
    }

    // 動画を再生
    this.video.currentTime = 0;
	this.video.play();
	
	// Playイベントハンドラがあれば実行
	if(this.handler.play && typeof this.handler.play=='function') {
	    this.handler.play();
	}
	
	// 既存のレンダリングループを停止
    clearInterval(this.timer);
    // レンダリングループを開始
	this.timer = setInterval(
		this._rendering(),
		1000 / d.meta.pin.meta.fps
	);
}


// 停止メソッド
// ----------------------------------------------
Discovery.prototype.stop = function() {
    // 既存のレンダリングループを停止
    clearInterval(this.timer);
    // 動画を停止
    this.video.pause();
}


// イベントハンドラ設定メソッド
// ----------------------------------------------
Discovery.prototype.bind = function(type, handler) {
    // イベントハンドラを保存
    this.handler[type] = handler;
}


// Canvas生成メソッド
// ----------------------------------------------
Discovery.prototype._createCanvas = function() {
	// Canvas要素を生成
	var canvas = $('<canvas></canvas>');
	canvas.attr({ id: 'overlay' });
	canvas.css({
		position:	'absolute',
		top:		'0',
		left:		'0',
		'z-index':	'9999'
	});
	
    return {
	    elem: canvas,
	    context: canvas.get(0).getContext("2d")
	};
};


// 動画読み込みメソッド
// ----------------------------------------------
Discovery.prototype._loadVideo = function(video) {
    var d = this;
    
    // 引数がなかったらエラーとする
    if(!video || !video.size()) {
        this._error('Video was not specified.');
        return;
    }
    
    // 読み込みが完了したらフラグを有効化
    video.bind("loadeddata", function(){
        d.flag.video = 1;
        d._debug('Video loaded.');
    });
    
    // 再生終了したらタイマーを停止
    video.bind("ended", function() {
        clearInterval(d.timer);
    });

    return video.get(0);
};


// 画像読み込みメソッド
// ----------------------------------------------
Discovery.prototype._loadImage = function(image, callback) {
    var image, d = this;
    
    // 引数がなかったらエラーとする
    if(!image) {
        this._error('Image was not specified.');
        return;
    }
    
    // 画像を生成
    image = $('<img src="'+image+'">');
    // 読み込みが完了したらフラグを有効化
    image.bind('load', function() {
        d.flag.image = 1;
        d._debug('Image loaded.');
        callback();
    });

    return image.get(0);
};


// 画像読み込みメソッド
// ----------------------------------------------
Discovery.prototype._loadMeta = function(meta) {
    var parser;

	// 設定がなければエラー
	if(!meta || !meta.pin || !meta.tracking) {
		this._error('Meta file was not specified.');
		return;
	}
	
	// メタデータを読み込み
   	data = {
        pin:        this._fetchFile(meta.pin),
        tracking:   this._fetchFile(meta.tracking)
    };
    // メタデータがなければエラー
	if(!data.pin || !data.tracking) {
		this._error('Unable to read meta file.');
		return;
	}
	
	// メタデータパーサーを生成して、ファイルをパース
	parser = new Discovery.MetaFileParser();
	data.pin = parser.parse_pin(data.pin);
	data.tracking = parser.parse_track(data.tracking);
	
	return data;
};


// ファイル取得メソッド
// ----------------------------------------------
Discovery.prototype._fetchFile = (function() {
    // 非同期通信を有効化
    $.ajaxSetup({ async: false });
    // ファイル取得メソッドの本体
    return function(url) {
        var data;
    	// GETレスポンスデータの取得
    	$.get(
    		url,
    		function(str) { data = str; }
    	);
    	return data;
    }
})();


// プリレンダリングメソッド
// ----------------------------------------------
Discovery.prototype._prerendering = function() {
    var level, image_size, frame, length, loop, d = this;
    
    // プリレンダリングデータを初期化
    this.prerendering = [];
    
    // 画像サイズを初期化
    size = {
        width: this.image.naturalWidth  || 150,
        height: this.image.naturalHeight || 150
    };

    // 現在のフレーム数を初期化
    frame = 0;
    // フレームの長さを取得
    length = this.meta.pin.point[0].length;
    
    // プリレンダリングループ関数
    loop = function() {
        // フレームの4点座標を取得
        var point = [
            d.meta.pin.point[0][frame],
		    d.meta.pin.point[1][frame],
		    d.meta.pin.point[2][frame],
		    d.meta.pin.point[3][frame]
        ];
        
        // プリレンダリングを実行
        d.prerendering.push(d._prerender(point, size));
        // デバッグ出力
        d._debug("Prerendering frame: "+frame);
        
        // 次のフレームがあれば続行
        if(++frame<length) {
            setTimeout(loop, 5);
        } else {
            d.flag.prerendering = 1;
        }
    }
    
    // プリレンダリングを実行
    loop();
};


// プリレンダリング座標計算メソッドメソッド
// ----------------------------------------------
Discovery.prototype._prerender = function(point, size) {
    var stage1 = [], stage2 = [], level = 1;
    var left_space, total_width, top_width, bottom_width, left_change;
    var left_top, right_top, left_bottom, right_bottom;
    
    // 一番左端にある座標を取得 - 左上X座標と左下X座標の小さい方を取得
    left_space = Math.min(point[0][0], point[2][0]);
    // 一番右端にある座標を取得し、実質的な幅を取得
    total_width = Math.max(point[1][0], point[3][0]) - left_space;
    // 上幅と下幅を取得
    top_width = point[1][0] - point[0][0];
    bottom_width = point[3][0] - point[2][0];
    // 左上と左下の差分を取得
    left_change = point[2][0] - point[0][0];
    
    // ステージ1座標計算
    for(var i=0; i<size.height; i+=level) {
        // 変換前座標
        var before = [0, i, size.width, level];
        // 変換後座標
        var after = [
            left_change*i/size.height,
            i, 
            Math.abs((top_width*(size.height-i)+bottom_width*i)/size.height),
            level
        ];
        // 配列に保存
        stage1.push([before, after]);
    }
    
    // 最終的なレンダリング座標を決定
	left_top		= point[0][1] - (point[1][1]-point[0][1]) * (point[0][0]-left_space) / (point[1][0]-point[0][0]);
	right_top		= point[1][1] + (point[1][1]-point[0][1]) * (left_space+total_width-point[1][0]) / (point[1][0]-point[0][0]);
	left_bottom		= point[2][1] - (point[3][1]-point[2][1]) * (point[2][0]-left_space)/(point[3][0]-point[2][0]) - left_top;
	right_bottom	= point[3][1] + (point[3][1]-point[2][1]) * (left_space+total_width-point[3][0]) / (point[3][0]-point[2][0]) - right_top;
    
    // ステージ2座標計算
    for (var i=0; i<total_width; i+=level) {
        // 変換前座標
        var before = [i, 0, level, size.height];
        // 変換後座標
        var after = [
            left_space+i, 
            (left_top*(total_width-i)+right_top*i)/total_width,
            level,
            (left_bottom*(total_width-i)+right_bottom*i)/total_width
		];
		// 配列に保存
        stage2.push([before, after]);
    }
    
    return {
        width:  total_width,
        height: size.height,
        stage1: stage1,
        stage2: stage2
    };
}


// レンダリングメソッド
// ----------------------------------------------
Discovery.prototype._rendering = function() {
    var d = this;
    var level = 1;
	var sub_context = document.createElement('CANVAS').getContext('2d');
    
	// クロージャを返す
	return function() {
        // 再生時間から現在のフレームを取得
	    var time = d.video.currentTime;
	    var frame = parseInt(time * d.meta.pin.meta.fps);
	    
	    // オーバーレイを初期化
		//d.canvas.context.clearRect(0, 0, 720, 480);
		// Video要素の内容をレンダリング
		d.canvas.context.drawImage(d.video, 0, 0);
		
		// 遅延フレーム判定
		if(frame < d.delay) {
		    return;
		}
	    
	    // フレームからプリレンダリングデータと座標を取得
	    var prerendering = d.prerendering[frame];
	    var point = [
		    d.meta.pin.point[0][frame],
		    d.meta.pin.point[1][frame],
		    d.meta.pin.point[2][frame],
		    d.meta.pin.point[3][frame]
		];
		
		// サブコンテキストのサイズを変更
        sub_context.canvas.setAttribute('width', prerendering.width);
        sub_context.canvas.setAttribute('height', prerendering.height);
        sub_context.clearRect(0, 0, prerendering.width, prerendering.height);
        // サブコンテキストを保存
        sub_context.save();

        // 左上より左下のX座標が大きければ、x方向に移動
        if(point[2][0] < point[0][0]) {
            sub_context.translate(point[0][0] - point[2][0], 0);
        }
        
        // ステージ1をレンダリング
        for(var i=0; i<prerendering.height; i+=level) {
            // 1行ずつプリレンダリングする
            sub_context.drawImage(
    			d.image,
    			prerendering.stage1[i][0][0],
    			prerendering.stage1[i][0][1],
    			prerendering.stage1[i][0][2],
    			prerendering.stage1[i][0][3],
    			prerendering.stage1[i][1][0],
    			prerendering.stage1[i][1][1], 
    			prerendering.stage1[i][1][2], 
    			prerendering.stage1[i][1][3]
    		);
        }
        
        // ステージ2をレンダリング
        try {
            for(var i=0; i<prerendering.width; i+=level) {
                // 1行ずつプリレンダリングする
                d.canvas.context.drawImage(
    			    sub_context.canvas,
    			    prerendering.stage2[i][0][0],
    			    prerendering.stage2[i][0][1],
    			    prerendering.stage2[i][0][2],
    		        prerendering.stage2[i][0][3],
    			    prerendering.stage2[i][1][0],
    			    prerendering.stage2[i][1][1], 
    			    prerendering.stage2[i][1][2],
    			    prerendering.stage2[i][1][3]
    		    );
            }
        } catch(e) {
    		// Nothing to do.
        }
        
        // サブコンテキストを復元
        sub_context.restore();
		
		// 処理フレーム数を超えたら、タイマーをクリア
	    if(frame >= d.meta.pin.point[0].length-1) {
	        clearInterval(d.timer);
	    }
	};
}


// エラー出力メソッド
// ----------------------------------------------
Discovery.prototype._error = function(msg) {
    this.debug ? console.log('Debug: '+msg) : alert('Error: '+msg);
    console.log(this);
};


// デバッグ出力メソッド
// ----------------------------------------------
Discovery.prototype._debug = function(msg) {
    if(this.debug) {
        console.log('Debug: '+msg)
    }
};



// ==============================================
// Discovery Meta File Parser Class
// ==============================================

// コンストラクタ
// ----------------------------------------------
Discovery.MetaFileParser = function() {
    this.pattern = {
        point:      new RegExp(/(\d+)\t([^\t\n]+)\t([^\t\n]+)\t/g),
        common:     new RegExp(/(\d+)\t([^\t\n]+)\t([^\t\n]+)\t([^\t\n]+)\t/g),
        rotation:   new RegExp(/(\d+)\t([^\t\n\r]+)\t?/g)
    };
};


// Pinファイル解析メソッド
// ----------------------------------------------
Discovery.MetaFileParser.prototype.parse_pin = function(str) {
    var pin = {
        meta:   this._parse_meta(str),
        point:  this._parse_pin_point(str)
    };
    
    return pin;
};


// PinファイルのMetaデータ解析メソッド
// ----------------------------------------------
Discovery.MetaFileParser.prototype._parse_meta = function(str) {
    var meta = {};
    
    str.match(/Units Per Second\s*([^\s]+)/);
    meta.fps = parseInt(RegExp.$1);
    
    str.match(/Source Width\s*(\d+)/);
    meta.width = parseInt(RegExp.$1);
    str.match(/Source Height\s*(\d+)/);
    meta.height = parseInt(RegExp.$1);
    
    str.match(/Source Pixel Aspect Ratio\s*([^\s]+)/);
    meta.source_aspect_ratio = parseInt(RegExp.$1);
    str.match(/Comp Pixel Aspect Ratio\s*([^\s]+)/);
    meta.comp_aspect_ratio = parseInt(RegExp.$1);
    
    return meta;
};


// PinファイルのPointデータ解析メソッド
// ----------------------------------------------
Discovery.MetaFileParser.prototype._parse_pin_point = function(str) {
    var source, length, point = [];
    
    // 配列に変換
    source = str.split(/\r?\n\r?\n/).slice(2, -1);
    // Point情報を抽出
    length = source.length;
    for(var i=0; i<length; i++) {
        point[i] = [];
        while(line = this.pattern.point.exec(source[i])) {
			for(var j=2; j<=4; j++) {
				line[j] = parseInt(line[j]);
			}
            point[i].push(line.slice(2, 4));
        }
    }
    
    return point;
};


// Trackingファイル解析メソッド
// ----------------------------------------------
Discovery.MetaFileParser.prototype.parse_track = function(str) {    
    var source = str.split(/\r?\n\r?\n/);
    var track = {
        meta:       this._parse_meta(str),
        anchor:     this._parse_track_common(source[2]),
        position:   this._parse_track_common(source[3]),
        scale:      this._parse_track_common(source[4]),
        rotation:   this._parse_track_rotation(source[5])
    };
    
    return track;
};


// Trackingファイルの汎用解析メソッド
// ----------------------------------------------
Discovery.MetaFileParser.prototype._parse_track_common = function(str) {
    var data = [];
    
    // データを抽出
    while(line = this.pattern.common.exec(str)) {
		for(var i=2; i<=5; i++) {
			line[i] = parseInt(line[i]);
		}
        data.push(line.slice(2, 5));
    }
	
    return data;
};


// Trackingファイルの回転情報解析メソッド
// ----------------------------------------------
Discovery.MetaFileParser.prototype._parse_track_rotation = function(str) {
    var rotation = [];
    
    // データを抽出
    while(line = this.pattern.rotation.exec(str)) {
		line[2] = parseInt(line[2]);
		line[3] = parseInt(line[3]);
        rotation.push(line.slice(2, 3));
    }
    
    return rotation;
};