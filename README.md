discovery.js
============

The Rendering Engine with HTML5 video and Mocha

これは何？
-----

Adobe AfterEffectsに付属しているMochaを利用して取得したモーショントラッキング情報を、HTML5ビデオに合成してCanvasに書きだすためのスクリプトです。
レコメガール（http://www.tatsuaki.net/recomegirl/）のレコメンド動画に利用しています。

使い方
---

discovery.jsを使うには、まずHTMLのscriptタグで読み込みます。
discovery.jsはjQueryに依存しているので、先に読み込む必要があります。

    <script src="js/jquery.js"></script>
    <script src="js/discovery.js"></script>

つづいて、discovery.jsを利用して動画を再生するコードを記述します。

    // プレイヤーを生成
    var player = new Discovery($("#player"));
    
    // 再生時のイベントハンドラを設定
    player.bind('play', function(){
        alert("Play!");
    });
        
    // メタ情報を設定
    player.activate({
        video: $("#video"),
        image: "images/sample.jpg",
        meta:  {
            pin: "meta/pin.txt",
            tracking: "meta/tracking.txt"
            },
        delay: 12
    });

    // 再生開始
    player.play();

上記の例では、まず #player 要素の中にdiscovery.jsのレンダリング用canvas要素が生成されます。
動画は #video の要素が利用され、その中に images/sample.jpg ファイルが画像として合成されます。
モーショントラッキング情報は、Mochaで生成した meta/pin.txt と meta/tracking.txt　がそれぞれ利用されます。
また、画像の合成は12フレーム目から実行されます。