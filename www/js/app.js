
const SERVICE_UUID = "6f0f0001-7b6d-4c4d-9b1f-2d6f7c4a1001";

const CHAR_ID_UUID = "6f0f0002-7b6d-4c4d-9b1f-2d6f7c4a1002";
const CHAR_NAME_UUID = "6f0f0003-7b6d-4c4d-9b1f-2d6f7c4a1003";
const CHAR_MAJOR_UUID = "6f0f0004-7b6d-4c4d-9b1f-2d6f7c4a1004";
const CHAR_GENDER_UUID = "6f0f0005-7b6d-4c4d-9b1f-2d6f7c4a1005";

let scanning = false;

const devices = new Map();


// ============================================================
// DEVICE READY
// ============================================================

document.addEventListener(
    "deviceready",
    function () {

        console.log(
            "SmartTrack Admin ready"
        );


        if (!window.ble) {

            showError(
                "BLE Central غير موجود داخل APK."
            );

            return;
        }


        document
            .getElementById(
                "startButton"
            )
            .addEventListener(
                "click",
                startRadar
            );


        document
            .getElementById(
                "stopButton"
            )
            .addEventListener(
                "click",
                stopRadar
            );

    },
    false
);


// ============================================================
// PERMISSIONS
// ============================================================

function requestBluetoothPermission() {

    return new Promise(
        function (resolve, reject) {

            if (
                !window.cordova ||
                !cordova.plugins ||
                !cordova.plugins.diagnostic
            ) {

                resolve();

                return;
            }


            cordova.plugins.diagnostic
                .requestBluetoothAuthorization(

                    function () {

                        resolve();

                    },

                    function (error) {

                        reject(error);

                    },

                    [
                        "BLUETOOTH_SCAN",
                        "BLUETOOTH_CONNECT"
                    ]

                );

        }
    );

}


// ============================================================
// START RADAR
// ============================================================

async function startRadar() {

    if (scanning) {
        return;
    }


    if (!window.ble) {

        showError(
            "إضافة BLE Central غير موجودة داخل التطبيق."
        );

        return;
    }


    try {

        clearError();


        setScanStatus(
            "جاري طلب صلاحيات BLE..."
        );


        await requestBluetoothPermission();


        await new Promise(
            function (resolve, reject) {

                ble.isEnabled(
                    function () {
                        resolve();
                    },
                    function (error) {
                        reject(error);
                    }
                );

            }
        );


        scanning = true;


        document
            .getElementById(
                "scanDot"
            )
            .classList.add(
                "active"
            );


        document
            .getElementById(
                "startButton"
            )
            .classList.add(
                "hidden"
            );


        document
            .getElementById(
                "stopButton"
            )
            .classList.remove(
                "hidden"
            );


        setScanStatus(
            "الرادار يعمل"
        );


        /*
         * CRITICAL:
         *
         * We filter by SERVICE UUID.
         *
         * We DO NOT filter by device.name.
         */


        ble.startScanWithOptions(

            [
                SERVICE_UUID
            ],

            {
                reportDuplicates:true,
                scanMode:"lowLatency",
                matchMode:"aggressive",
                numOfMatches:"max"
            },

            function (device) {

                console.log(
                    "SmartTrack device:",
                    JSON.stringify(device)
                );


                if (
                    !device ||
                    !device.id
                ) {
                    return;
                }


                processDevice(
                    device
                );

            },

            function (error) {

                console.error(
                    "SCAN ERROR:",
                    error
                );


                stopRadar();


                showError(
                    "فشل BLE Scan:\n" +
                    String(error)
                );

            }

        );


    } catch (error) {

        stopRadar();


        showError(
            "تعذر تشغيل الرادار:\n" +
            String(error)
        );

    }

}


// ============================================================
// STOP
// ============================================================

function stopRadar() {

    if (
        window.ble &&
        ble.stopScan
    ) {

        ble.stopScan(
            function () {},
            function () {}
        );

    }


    scanning = false;


    document
        .getElementById(
            "scanDot"
        )
        .classList.remove(
            "active"
        );


    document
        .getElementById(
            "startButton"
        )
        .classList.remove(
            "hidden"
        );


    document
        .getElementById(
            "stopButton"
        )
        .classList.add(
            "hidden"
        );


    setScanStatus(
        "الرادار متوقف"
    );

}


// ============================================================
// PROCESS DEVICE
// ============================================================

function processDevice(device) {

    const id =
        String(
            device.id
        );


    const rssi =
        Number(
            device.rssi || 0
        );


    let item =
        devices.get(id);


    if (!item) {

        item = {

            deviceId:id,

            rssi:rssi,

            uuid:null,

            name:null,

            major:null,

            gender:null,

            reading:false,

            lastSeen:
                Date.now()

        };


        devices.set(
            id,
            item
        );


        render();


        readUserData(
            item
        );


    } else {

        item.rssi =
            rssi;

        item.lastSeen =
            Date.now();


        render();

    }

}


// ============================================================
// READ USER DATA
// ============================================================

function readUserData(item) {

    if (item.reading) {
        return;
    }


    item.reading = true;


    ble.connect(

        item.deviceId,

        function () {

            /*
             * Read UUID first.
             */

            readCharacteristic(

                item,

                CHAR_ID_UUID,

                function (buffer) {

                    item.uuid =
                        bytesToUuid(
                            new Uint8Array(
                                buffer
                            )
                        );


                    readCharacteristic(

                        item,

                        CHAR_NAME_UUID,

                        function (nameBuffer) {

                            item.name =
                                decodeUtf8(
                                    nameBuffer
                                );


                            readCharacteristic(

                                item,

                                CHAR_MAJOR_UUID,

                                function (majorBuffer) {

                                    item.major =
                                        decodeUtf8(
                                            majorBuffer
                                        );


                                    readCharacteristic(

                                        item,

                                        CHAR_GENDER_UUID,

                                        function (genderBuffer) {

                                            const bytes =
                                                new Uint8Array(
                                                    genderBuffer
                                                );


                                            item.gender =
                                                bytes[0] === 2
                                                    ? "أنثى"
                                                    : "ذكر";


                                            item.reading =
                                                false;


                                            render();


                                            disconnect(
                                                item.deviceId
                                            );

                                        },

                                        function () {

                                            finishRead(
                                                item
                                            );

                                        }

                                    );

                                },

                                function () {

                                    finishRead(
                                        item
                                    );

                                }

                            );

                        },

                        function () {

                            finishRead(
                                item
                            );

                        }

                    );

                },

                function () {

                    finishRead(
                        item
                    );

                }

            );

        },

        function () {

            item.reading =
                false;

            render();

        }

    );

}


// ============================================================
// READ
// ============================================================

function readCharacteristic(
    item,
    characteristicUUID,
    success,
    failure
) {

    ble.read(

        item.deviceId,

        SERVICE_UUID,

        characteristicUUID,

        success,

        failure

    );

}


// ============================================================
// FINISH
// ============================================================

function finishRead(item) {

    item.reading =
        false;

    render();

    disconnect(
        item.deviceId
    );

}


// ============================================================
// DISCONNECT
// ============================================================

function disconnect(id) {

    try {

        ble.disconnect(
            id,
            function () {},
            function () {}
        );

    } catch (e) {}

}


// ============================================================
// UUID
// ============================================================

function bytesToUuid(bytes) {

    if (
        !bytes ||
        bytes.length !== 16
    ) {

        return "غير صالح";

    }


    const hex =
        Array.from(bytes)
            .map(
                b =>
                    b.toString(16)
                     .padStart(2,"0")
            )
            .join("");


    return (
        hex.slice(0,8) + "-" +
        hex.slice(8,12) + "-" +
        hex.slice(12,16) + "-" +
        hex.slice(16,20) + "-" +
        hex.slice(20)
    );

}


// ============================================================
// UTF8
// ============================================================

function decodeUtf8(buffer) {

    if (!buffer) {
        return "";
    }


    try {

        return new TextDecoder(
            "utf-8"
        )
        .decode(buffer)
        .replace(/\0/g,"")
        .trim();

    } catch (e) {

        const bytes =
            new Uint8Array(
                buffer
            );


        return String
            .fromCharCode(
                ...bytes
            )
            .replace(
                /\0/g,
                ""
            )
            .trim();

    }

}


// ============================================================
// DISTANCE
// ============================================================

function distanceFromRssi(rssi) {

    if (
        !Number.isFinite(rssi) ||
        rssi === 0
    ) {

        return "غير معروف";

    }


    const txPower =
        -59;


    const ratio =
        rssi / txPower;


    let distance;


    if (
        ratio < 1
    ) {

        distance =
            Math.pow(
                ratio,
                10
            );

    } else {

        distance =
            0.89976 *
            Math.pow(
                ratio,
                7.7095
            ) +
            0.111;

    }


    if (
        !Number.isFinite(
            distance
        )
    ) {

        return "غير معروف";

    }


    return (
        Math.min(
            distance,
            100
        )
        .toFixed(1)
        +
        " m"
    );

}


// ============================================================
// RENDER
// ============================================================

function render() {

    const list =
        document.getElementById(
            "usersList"
        );


    const empty =
        document.getElementById(
            "emptyState"
        );


    const count =
        document.getElementById(
            "deviceCount"
        );


    /*
     * Remove devices not seen for 15 seconds.
     */

    const now =
        Date.now();


    for (
        const [
            id,
            item
        ]
        of devices.entries()
    ) {

        if (
            now -
            item.lastSeen
            >
            15000
        ) {

            devices.delete(
                id
            );

        }

    }


    count.innerText =
        String(
            devices.size
        );


    if (
        devices.size === 0
    ) {

        list.innerHTML =
            "";

        empty.classList.remove(
            "hidden"
        );

        return;

    }


    empty.classList.add(
        "hidden"
    );


    list.innerHTML =
        "";


    const sorted =
        Array.from(
            devices.values()
        )
        .sort(
            (a,b) =>
                b.rssi -
                a.rssi
        );


    sorted.forEach(
        function (item) {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "user";


            const name =
                item.name ||
                (
                    item.reading
                        ? "جاري قراءة المستخدم..."
                        : "مستخدم SmartTrack"
                );


            const major =
                item.major ||
                (
                    item.reading
                        ? "جاري القراءة..."
                        : "غير متوفر"
                );


            const gender =
                item.gender ||
                (
                    item.reading
                        ? "جاري القراءة..."
                        : "غير متوفر"
                );


            const uuid =
                item.uuid ||
                (
                    item.reading
                        ? "جاري القراءة..."
                        : item.deviceId
                );


            card.innerHTML =

                "<div class='userHead'>" +

                    "<div class='name'>" +
                        escapeHtml(name) +
                    "</div>" +

                    "<div class='online'>" +
                        "قريب" +
                    "</div>" +

                "</div>" +


                "<div class='grid'>" +

                    "<div class='item'>" +
                        "<span>التخصص</span>" +
                        "<strong>" +
                            escapeHtml(major) +
                        "</strong>" +
                    "</div>" +


                    "<div class='item'>" +
                        "<span>الجنس</span>" +
                        "<strong>" +
                            escapeHtml(gender) +
                        "</strong>" +
                    "</div>" +


                    "<div class='item'>" +
                        "<span>RSSI</span>" +
                        "<strong class='rssi'>" +
                            escapeHtml(
                                String(
                                    item.rssi
                                )
                            ) +
                            " dBm" +
                        "</strong>" +
                    "</div>" +


                    "<div class='item'>" +
                        "<span>المسافة التقريبية</span>" +
                        "<strong class='distance'>" +
                            escapeHtml(
                                distanceFromRssi(
                                    item.rssi
                                )
                            ) +
                        "</strong>" +
                    "</div>" +


                    "<div class='item'>" +
                        "<span>UUID</span>" +
                        "<strong class='uuid'>" +
                            escapeHtml(uuid) +
                        "</strong>" +
                    "</div>" +

                "</div>";


            list.appendChild(
                card
            );

        }
    );

}


// ============================================================
// ESCAPE
// ============================================================

function escapeHtml(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ============================================================
// STATUS
// ============================================================

function setScanStatus(text) {

    document
        .getElementById(
            "scanStatus"
        )
        .innerText =
            text;

}


function showError(text) {

    const box =
        document.getElementById(
            "errorBox"
        );


    box.innerText =
        text;


    box.classList.remove(
        "hidden"
    );

}


function clearError() {

    const box =
        document.getElementById(
            "errorBox"
        );


    box.innerText =
        "";


    box.classList.add(
        "hidden"
    );

}


// ============================================================
// REFRESH
// ============================================================

setInterval(
    function () {

        if (scanning) {
            render();
        }

    },
    2000
);

