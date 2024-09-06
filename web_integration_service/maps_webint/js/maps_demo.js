/*
 * (c) 2016-2017 Copyright, Real-Time Innovations, Inc.  All rights reserved.
 * RTI grants Licensee a license to use, modify, compile, and create derivative
 * works of the Software.  Licensee has the right to distribute object form
 * only for use with RTI products.  The Software is provided "as is", with no
 * warranty of any type, including any warranty for fitness for any purpose.
 * RTI is under no obligation to maintain or support the Software.  RTI shall
 * not be liable for any incidental or consequential damages arising out of the
 * use or inability to use the software.
 */

// For the selected cars
var selectedCar = new Set();    //idCar

// For remarking the selected cars
var circleMap = new Map();      //idCar

// For the map
var carMarkerMap = new Map();   //idCar

var failureMarkerMap = new Map();   //idCar

var carsAlive = new Map();  //instanceHandle

var drawRoutes = new Map();     //instanceHandle

var alternativeRoutes = new Map();   //idCar

var ownership = new Set;

var user = null;

var currentRouteColor = new Map();

var users_in_control = new Map();

var selectedRouteColor = 'red';

var unselectedRouteColor = 'grey';

var assistancePopUps = new Map();

var assitanceCanvas = new Map();

var canvasCars = new Map();

// Initialize the map and set the view to the bounding box
var map = L.map('mapid', {
    minZoom: 16,
    maxZoom: 16,
    zoomControl: false,
    maxBounds: [
        [37.149, -3.62], // Southwest coordinates
        [37.2, -3.58]  // Northeast coordinates
    ]
}).fitBounds([
    [37.161816, -3.606209],
    [37.18528418774586, -3.602234531480485]
]);

// Add a tile layer to the map (OpenStreetMap)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// #bbox = (-3.606209, 37.161816, -3.602234531480485, 37.18528418774586)  # Even smaller area in Granada
var lat = 37.161816;
var lon = -3.606209;
// var size = 0.0005;
// var bounds = [[lat, lon], [lat + size, lon + size]];
// var rectangle = L.rectangle(bounds, {color: "#ff7800", weight: 1}).addTo(map);

// document.getElementById('menuButton').addEventListener('click', function() {
//     var sidebar = document.getElementById('sidebar');
//     if (sidebar.classList.contains('show')) {
//         sidebar.classList.remove('show');
//     } else {
//         sidebar.classList.add('show');
//     }
// });

map.on('click', function(e) {
    if (selectedCar.size > 0) {
        var content = "Do you want to send cars to this position (" + e.latlng.lat + ", " + e.latlng.lng + ")? <br>";
        for (let id of selectedCar) {
            content += " - Car " + id + "<br>";
        }
        content += "<button id='submitButton'>Submit</button>";
        var popup = L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
    }

    setTimeout(function() {
        var acceptButton = document.getElementById('submitButton');
        if (acceptButton) {
            acceptButton.addEventListener('click', function() {
                for (let id of selectedCar) {
                    sendCars(id, e.latlng.lng, e.latlng.lat);
                    var circle = circleMap.get(id);
                    circle.remove();
                    selectedCar.delete(id);
                }
                popup.remove();
            });
        }
    }, 10);
});

// Load car image
const carImage = new Image();
carImage.src = '../../resources/img/cenital_car.png'; // Path to car image

var obstacleImage = new Image();
obstacleImage.src = '../../resources/img/cone.png';

var manholeImage = new Image();
manholeImage.src = '../../resources/img/manhole.png';

var canvas_width = 640;
var canvas_height = 360;

var canvas = document.getElementById('assistCanvas');
canvas.width = canvas_width; // Set the width of the canvas
canvas.height = canvas_height; // Set the height of the canvas



// map.on('click', function(e) {
//     if (failureMarkerMap.size > 0 && selectedCar.size == 1) {
//         var content = "Do you want to add this point to the alternative route (" + e.latlng.lat + ", " + e.latlng.lng + ") to the Car" + selectedCar.values().next().value + "? <br>";
//         // for (let id of selectedCar) {
//         //     content += " - Car " + id + "<br>";
//         // }
//         content += "<button id='sendRoute'>Send Route</button>";
//         content += "<button id='addPoint'>Add Point</button>";
//         var popup = L.popup().setLatLng(e.latlng).setContent(content).openOn(map);
//     }

//     setTimeout(function() {
//         var sendButton = document.getElementById('sendRoute');
//         var addPointButton = document.getElementById('addPoint');
//         if (sendButton) {
//             sendButton.addEventListener('click', function() {
//                 var carId = selectedCar.keys().next().value; 
//                 var route = alternativeRoute.get(carId);

//                 if (route.length > 0) {
//                     sendRoute(carId, route);
//                 }

//                 var circle = circleMap.get(id);
//                 circle.remove();
//                 selectedCar.delete(id);

//                 popup.remove();
//             });
//         }
//         if (addPointButton){
//             sendButton.addEventListener('click', function() {
//                 var carId = selectedCar.keys().next().value; 
//                 var route = alternativeRoute.get(carId); 

//                 if (route.length == 0) {
//                     route = []
//                 }

//                 route.push({x: e.latlng.lat, y: e.latlng.lng}); 

//                 alternativeRoute.set(carId, route);
//                 popup.remove();
//             });
//         }
//     }, 10);
// });

async function setupScenario() {
    const rest_websocket_path = "/dds/v1/websocket_connections";
    const websocket_name = "MyWebSocketConnection";

    try {
        await historicalCarsData();
        await historicalRoutesData();
        await historicalFailureAssistanceData();

        $.ajax({
            type: "POST",
            url: window.location.origin + rest_websocket_path,
            data: JSON.stringify(
                [{ "name": websocket_name }]
            ),
            contentType: "application/dds-web+json",
            dataType: "json",
            success: function (response) {
                console.log("WebSocket Enable");
                readCars();
                readRoute();
                readFailureAssistance();
                replayControl();
                requestReader();
            },
            failure: function (response) {
                console.log("No WebSocket enable");
                console.log("Error: " + response.responseText);
            }
        });
    } catch(error) {
        console.log("Error: " + error);
    }
}

function createWebSocket(url, topicName) {
    const ws_protocol = 'ws://';
    const ws_path = '/dds/websocket/MyWebSocketConnection';
    const hostname = window.location.host;

    var websocket = new WebSocket( ws_protocol + hostname + ws_path );

    websocket.onmessage = function (raw_samples) {;
        try {
            if(raw_samples.data.includes("HELLO")){
                console.log(raw_samples.data);
            } else{
                var samples = JSON.parse(raw_samples.data);
                console.log(topicName);
                switch (topicName) {
                    case 'Car Position':
                        drawCar(samples);
                        break;
                    case 'Route':
                        drawRoute(samples);
                        break;
                    case 'Failure Assistance':
                        drawFailure(samples);
                        break;
                    case 'Replay Control':
                        manageReplay(samples);
                        break;
                    case 'Request Control':
                        releaseCar(samples);
                        break;
                    default:
                        console.log('Unknown topic');
                }
            }
        } catch (error) {
            console.log("Error: " + error.message);
        }

    }

    websocket.onerror = function () {
        alert("Error: webSocket is not enabled");
        websocket.close();
    }

    websocket.onopen = function () {
        //Send a hello Message" to make the handshake with the server.
        var hello_msg =
            "Content-Type:application/dds-web+json\r\n" +
            "Accept:application/dds-web+json\r\n" +
            "OMG-DDS-API-Key:<your-api-key>\r\n"+
            "Version:1\r\n\r";
        websocket.send(hello_msg);

        // Send a bind message with the URI of the DataReader
        // you want to use to subscribe to shapes.

        var bind_msg =
            {
                "kind": "bind",
                "body": [
                    {
                        "bind_kind":"bind_datareader",
                        "bind_id": topicName,
                        "uri": url
                    }
                ]
            };

            websocket.send(JSON.stringify(bind_msg));
    }
    return websocket;
}



// Function in charge of reading the data from the CarReader
function readCars() {
    var carReaderUrl =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/subscribers/MySubscriber" +
        "/data_readers/MyCarReader";

    // Creation of the car WebSocket
    car_ws = createWebSocket(carReaderUrl, "Car Position");
}

function historicalCarsData() {
    return new Promise((resolve, reject) => {
        var carHistoricalReaderUrl =
            "/dds/rest1/applications/MapsDemoApp" +
            "/domain_participants/MyParticipant" +
            "/subscribers/MySubscriber" +
            "/data_readers/MyCarHistoricalReader";

        $.getJSON(
            carHistoricalReaderUrl,
            {
                sampleFormat: "json",
                removeFromReaderCache: "false"
            },
            function(data) {
                setHistoricalCar(data);
                resolve();
            }
        ).fail(function(jqXHR, textStatus, errorThrown) {
            reject(errorThrown);
        });
    });
}

function readRoute(){
    var routeReaderUrl =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/subscribers/MySubscriber" +
        "/data_readers/MyRouteReader";

    // Creation of the car WebSocket
    route_ws = createWebSocket(routeReaderUrl, "Route");
}

function historicalRoutesData() {
    return new Promise((resolve, reject) => {
        var routeHistoricalReaderUrl =
            "/dds/rest1/applications/MapsDemoApp" +
            "/domain_participants/MyParticipant" +
            "/subscribers/MySubscriber" +
            "/data_readers/MyRouteHistoricalReader";

        $.getJSON(
            routeHistoricalReaderUrl,
            {
                sampleFormat: "json",
                removeFromReaderCache: "false"
            },
            function(data) {
                drawRouteHistorical(data);
                resolve();
            }
        ).fail(function(jqXHR, textStatus, errorThrown) {
            reject(errorThrown);
        });
    });
}

function readFailureAssistance(){
    var failureAssistanceReaderUrl =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/subscribers/MySubscriber" +
        "/data_readers/MyFailureAssistanceReader";

    // Creation of the failure WebSocket
    failure_assistance_ws = createWebSocket(failureAssistanceReaderUrl, "Failure Assistance");
}

function historicalFailureAssistanceData() {
    return new Promise((resolve, reject) => {
        var failureAssistanceHistoricalReaderUrl =
            "/dds/rest1/applications/MapsDemoApp" +
            "/domain_participants/MyParticipant" +
            "/subscribers/MySubscriber" +
            "/data_readers/MyFailureAssistanceHistoricalReader";

        $.getJSON(
            failureAssistanceHistoricalReaderUrl,
            {
                sampleFormat: "json",
                removeFromReaderCache: "false"
            },
            function(data) {
                drawFailureHistorical(data);
                resolve();
            }
        ).fail(function(jqXHR, textStatus, errorThrown) {
            reject(errorThrown);
        });
    });
}

function replayControl(){
    var replayControlUrl =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/subscribers/MySubscriber" +
        "/data_readers/MyReplayControlReader";

    // Creation of the replay control WebSocket
    replay_control_ws = createWebSocket(replayControlUrl, "Replay Control");
}

function requestReader(){
    var releaseReaderUrl =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/subscribers/MySubscriber" +
        "/data_readers/MyRequestControlReader";

    // Creation of the replay control WebSocket
    request_control_ws = createWebSocket(releaseReaderUrl, "Request Control");
}


function sendCars(idCar, xCoordinate, yCoordinate) {
    var commandWritter =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/publishers/MyPublisher" +
        "/data_writers/MyCommandWriter";
    
    var xmlData = '<data>' +
        '<id>' + idCar + '</id>' +
        '<destination>' +
        '<lon>' + xCoordinate + '</lon>' +
        '<lat>' + yCoordinate + '</lat>' +
        '</destination>' +
        '</data>';


    // Make the AJAX request
    $.ajax({
        url: commandWritter,
        type: 'POST',
        data: xmlData,
        contentType: 'application/dds-web+xml',
        headers: {
            'Cache-Control': 'no-cache'
        },
        dataType: 'xml',
        async: false,
    });
}

function sendRoute(idCar, route) {
    var routeWriter =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/publishers/MyPublisher" +
        "/data_writers/MyRouteWriter";
    
        var xmlData = '<data>' +
        '<id>' + idCar + '</id>' +
        '<path>';

        // Iterar sobre la ruta y agregar cada par de coordenadas x e y al XML
        for (var i = 0; i < route.length; i++) {
            xmlData += '<position>' +
               '<lon>' + route[i].lon + '</lon>' +
               '<lat>' + route[i].lat + '</lat>' +
               '</position>';
        }

        xmlData += '</path>' +
                '</data>';


    // Make the AJAX request
    $.ajax({
        url: routeWriter,
        type: 'POST',
        data: xmlData,
        contentType: 'application/dds-web+xml',
        headers: {
            'Cache-Control': 'no-cache'
        },
        dataType: 'xml',
        async: false,
    });
}

function sendAssistance(idCar) {
    console.log("Sending assistance to car " + idCar);
    var assistanceWriter =
        "/dds/rest1/applications/MapsDemoApp" +
        "/domain_participants/MyParticipant" +
        "/publishers/MyPublisher" +
        "/data_writers/MyFailureAssistanceWriter";


    var xmlData = '<data>' +
        '<id_car>' + idCar + '</id_car>' +
        '<need_asistance>' + false + '</need_asistance>' +
        '</data>';

    // Make the AJAX request
    $.ajax({
        url: assistanceWriter,
        type: 'POST',
        data: xmlData,
        contentType: 'application/dds-web+xml',
        headers: {
            'Cache-Control': 'no-cache'
        },
        dataType: 'xml',
        async: false,
    });
}

function requestControl(user, idCar, type){
    var controlWriter =
    "/dds/rest1/applications/MapsDemoApp" +
    "/domain_participants/MyParticipant" +
    "/publishers/MyPublisher" +
    "/data_writers/MyRequestControlWriter";

    var xmlData = '<data>' +
        '<id_user>' + user + '</id_user>' +
        '<id_car>' + idCar + '</id_car>' +
        '<request>' + type + '</request>' +
        '</data>';

    // Make the AJAX request
    $.ajax({
        url: controlWriter,
        type: 'POST',
        data: xmlData,
        contentType: 'application/dds-web+xml',
        headers: {
            'Cache-Control': 'no-cache'
        },
        dataType: 'xml',
        async: false,
    });
}

// TODO: CHANGE ALL THE MAPS TO INSTANCE HANDLES INSTEAD OF IDS FOR THE DELETE MANAGE
var count = 0;

function drawCar(sampleSeq) {  
    sampleSeq.body.read_sample_seq.forEach(
        function(sample, i, samples) {
        // Process metadata
        var validData = sample.read_sample_info.valid_data;
        var instanceHandle = sample.read_sample_info.instance_handle;
        var instanceState  = sample.read_sample_info.instance_state;
        
        // If we received an invalid data sample we do nothing
        // if (!validData) {
        //     return false;
        // }

        if (instanceState != "ALIVE") {
            console.log("Removing car " + instanceHandle);
            if (carsAlive.has(instanceHandle)) {
                var car_id = carsAlive.get(instanceHandle).id;
                var carMarker = carMarkerMap.get(car_id);
                carMarker.remove();
                carMarkerMap.delete(car_id);

                carsAlive.delete(instanceHandle);
                currentRouteColor.delete(instanceHandle);
                updateCarList();

                if (selectedCar.has(car_id)) {
                    var circle = circleMap.get(car_id);
                    circle.remove();
                    circleMap.delete(car_id);
                    selectedCar.delete(car_id);
                }

                if (drawRoutes.has(instanceHandle)) {
                    var polylineToRemove = drawRoutes.get(instanceHandle);
                    polylineToRemove.remove();
                    drawRoutes.delete(instanceHandle);
                }

                if (failureMarkerMap.has(car_id)) {
                    var failureMarkerToRemove = failureMarkerMap.get(car_id);
                    failureMarkerToRemove.remove();
                    failureMarkerMap.delete(car_id);
                }

                if (users_in_control.has(car_id)){
                    users_in_control.delete(car_id);
                }

                if (ownership.has(car_id)){
                    ownership.delete(car_id);
                }
            }

            return false;
        }        

        if (sample) {
            count ++;
            var id = sample.data.id;
            var lon = sample.data.current_position.lon;
            var lat = sample.data.current_position.lat; 
            var angle = sample.data.angle;
            var adjustedAngle = (angle + 90) % 360;
            var user_driving = sample.data.user_in_control;

            carsAlive.set(instanceHandle, sample.data);

            if (users_in_control.get(id) != user_driving){
                users_in_control.set(id, user_driving);
                updateCarList();
            }

            if (!drawRoutes.has(instanceHandle)){
                console.log("Calling historical data from drawCar")
                historicalRoutesData();
            }

            var car = undefined;
            if (carMarkerMap.has(id)) {
                car = carMarkerMap.get(id);
            }

            // If the car image doesn't exist, create it
            if (car == undefined) {
                var carIcon = L.icon({
                    iconUrl: '../../resources/img/car' + id%7 + '.png',
                    iconSize: [33, 20],
                    iconAnchor: [16.5, 10],
                    popupAnchor: [-3, -76]
                });

                var carMarker = L.marker([lat, lon], {icon: carIcon, rotationAngle: adjustedAngle}).addTo(map);

                carMarker.on('click', function(){
                    carClickHandler(id, carMarker)
                });
                
                updateCarList();
                carMarkerMap.set(id, carMarker);
                currentRouteColor.set(instanceHandle, unselectedRouteColor);

            } else { // If the car image exists, update its position
                var carMarker = carMarkerMap.get(id);
                carMarker.setLatLng([lat, lon]);
                carMarker.setRotationAngle(adjustedAngle);

                if (selectedCar.has(id)) {
                    var circle = circleMap.get(id);
                    circle.setLatLng([lat, lon]);
                }

                if (drawRoutes.has(instanceHandle)){
                    if (ownership.has(id)){
                        if (currentRouteColor.get(instanceHandle) != selectedRouteColor){
                            var polyline = drawRoutes.get(instanceHandle);
                            polyline.remove();
                            
                            var newPolyline = L.polyline(polyline.getLatLngs(), { color: selectedRouteColor }).addTo(map);
                            currentRouteColor.set(instanceHandle, selectedRouteColor);
                            drawRoutes.set(instanceHandle, newPolyline);
                        }
                    }else{
                        if (currentRouteColor.get(instanceHandle) != unselectedRouteColor){
                            var polyline = drawRoutes.get(instanceHandle);
                            polyline.remove();
                            
                            var newPolyline = L.polyline(polyline.getLatLngs(), { color: unselectedRouteColor }).addTo(map);
                            currentRouteColor.set(instanceHandle, unselectedRouteColor);
                            drawRoutes.set(instanceHandle, newPolyline);
                        }
                    }
                }
            
                // var current_car = carsAlive.get(instanceHandle);
                // if (current_car.arrival && drawRoutes.has(instanceHandle)) {
                //     console.log("Removing route of car " + sample.data.id);
                //     var polylineToRemove = drawRoutes.get(instanceHandle);
                //     polylineToRemove.remove();
                //     drawRoutes.delete(instanceHandle);
                // }

            }

        }
    });
}

function carClickHandler(id, carMarker) {
    if (carMarkerMap.has(id)) {
        if (ownership.has(id)){
            console.log("Clicked on car " + id);
            if (selectedCar.has(id)) {
                var circle = circleMap.get(id);
                circle.remove();
                selectedCar.delete(id);
            } else if (!failureMarkerMap.has(id)){
                selectedCar.add(id);
                var circle = L.circle(carMarker.getLatLng(), {
                    color: 'red',
                    fillColor: '#f03',
                    fillOpacity: 0,
                    radius: 30,
                    interactive: false
                });
                circleMap.set(id, circle);
                circle.addTo(map);
            }
        }else if (ownership.size === 0){
            
            var requestControlButton = document.createElement('button');
            requestControlButton.id = 'requestControlButton';
            requestControlButton.innerText = 'Control';
        
            requestControlButton.addEventListener('click', function() {
                requestControlButton.style.display = 'none';
                carMarker.closePopup();
                carMarker.unbindPopup();
                requestControl(user, id, "CONTROL");
            });
        
            // Create a container for the popup content
            var popupContent = document.createElement('div');
            popupContent.innerHTML = '<p>Do you want to control this car?</p>';

            // Bind the popup to the marker
            carMarker.bindPopup(popupContent);

            popupContent.appendChild(requestControlButton);
            carMarker.openPopup();
        }
        map.setView(carMarker.getLatLng(), 13);
    }
}

function setHistoricalCar(sampleSeq){
    sampleSeq.forEach(function(sample, i, samples) {
        // Process metadata
        var validData = sample.read_sample_info.valid_data;
        var instanceHandle = sample.read_sample_info.instance_handle;
        var instanceState  = sample.read_sample_info.instance_state;

        // If we received an invalid data sample, and the instance state
        // is != ALIVE, then the instance has been either disposed or
        // unregistered and we remove the shape from the canvas.

        if (!validData) {  
            return false;
        }

        if (instanceState != "ALIVE") {
            return false;
        }

        console.log("INSIDE SET HISTORICAL CAR");

        if (sample) {
            console.log(sample);
            carsAlive.set(instanceHandle, sample.data);

        }
    });
}


function manageReplay(sampleSeq) {
    sampleSeq.body.read_sample_seq.forEach(
        function(sample, i, samples) {
            var instanceHandle = sample.read_sample_info.instance_handle;
            if (sample) {
                if (user == sample.data.id_user && carMarkerMap.has(sample.data.id_car)){
                    console.log(sample.data.replay);
                    if (sample.data.replay === "AVAILABLE") {
                        ownership.add(sample.data.id_car);
                        console.log("Car " + sample.data.id_car + " is now controlled by " + sample.data.id_user);
                    } else if (sample.data.replay === "BUSY") {
                        alert("Car " + sample.data.id_car + " is busy");
                    } else if (sample.data.replay === "FAIL") {
                        alert("There is some type of error with the request");
                    }
                }
                //else{
                //     alert("That car id does not exist");
                // }
        }
    });
    updateCarList();
}

// This function is called when the timer in the car has expired and it releases the car
function releaseCar(sampleSeq) {
    sampleSeq.body.read_sample_seq.forEach(
        function(sample, i, samples) {
            if (sample) {
                if (ownership.has(sample.data.id_car) && sample.data.request === "RELEASE") {
                    ownership.delete(sample.data.id_car);
                    var circle = circleMap.get(data[1].id);
                    if (circle){
                        circle.remove();
                    }
                    selectedCar.delete(data[1].id);
                    updateCarList();
                }
            }
    });
}


function drawFailure(sampleSeq) {
    sampleSeq.body.read_sample_seq.forEach(
        function(sample, i, samples) {
        // Process metadata
        var instanceHandle = sample.read_sample_info.instance_handle;
        
        if (sample) {
            count ++;
            var id = sample.data.id_car;

            var need_asistance = sample.data.need_asistance;

            if (need_asistance && carsAlive.has(instanceHandle)){
                var current_car = carsAlive.get(instanceHandle);
                var lon = current_car.current_position.lon;
                var lat = current_car.current_position.lat;
                console.log("Car " + id + " needs assistance");  

                if (selectedCar.has(id)) {
                    var circle = circleMap.get(id);
                    circle.remove();
                    selectedCar.delete(id);
                }

                var failureIcon = L.icon({
                    iconUrl: '../../resources/img/failure.png',
                    iconSize: [33, 20],
                    iconAnchor: [16.5, 10],
                    popupAnchor: [-3, -76]
                });

                var failureMarker = L.marker([lat, lon], {
                    icon: failureIcon,
                    zIndexOffset: 1000 // Make the marker appear on top of the car
                }).addTo(map);
                
                failureMarkerMap.set(id, failureMarker);

                // When the marker is clicked, move the button to the popup and open the popup
                failureMarker.on('click', function() {
                    failureMarkerHandler(id, failureMarkerMap);    
                });

                updateCarList();
            }else if(!need_asistance){
                if (failureMarkerMap.has(id)){
                    var failureMarker = failureMarkerMap.get(id);
                    failureMarker.remove();
                    failureMarkerMap.delete(id);
                }
                updateCarList();
            }
        }
    });
}

function drawFailureHistorical(sampleSeq){
    sampleSeq.forEach(function(sample, i, samples) {
        // Process metadata
        var instanceHandle = sample.read_sample_info.instance_handle;

        console.log("INSIDE DRAW FAILURE HISTORICAL");

        if (sample) {
            count ++;
            var id = sample.data.id_car;

            var need_asistance = sample.data.need_asistance;

            if (need_asistance && carsAlive.has(instanceHandle)){
                var current_car = carsAlive.get(instanceHandle);
                var lon = current_car.current_position.lon;
                var lat = current_car.current_position.lat;
                console.log("Car " + id + " needs assistance");  

                if (selectedCar.has(id)) {
                    var circle = circleMap.get(id);
                    circle.remove();
                    selectedCar.delete(id);
                }

                var failureIcon = L.icon({
                    iconUrl: '../../resources/img/failure.png',
                    iconSize: [33, 20],
                    iconAnchor: [16.5, 10],
                    popupAnchor: [-3, -76]
                });

                var failureMarker = L.marker([lat, lon], {
                    icon: failureIcon,
                    zIndexOffset: 1000 // Make the marker appear on top of the car
                }).addTo(map);   

                // Create a container for the popup content
                
                failureMarkerMap.set(id, failureMarker);

                // When the marker is clicked, move the button to the popup and open the popup
                failureMarker.on('click', function() {
                    failureMarkerHandler(id, failureMarkerMap);    
                });

                updateCarList();
            }else{
                if (failureMarkerMap.has(id)){
                    var failureMarker = failureMarkerMap.get(id);
                    failureMarker.remove();
                    failureMarkerMap.delete(id);
                }
                updateCarList();
            }
        }
    });
}

function failureMarkerHandler(id, failureMarkerMap){
    var failureMarker = failureMarkerMap.get(id);
    // var canvas = createCanvas(id);
    var car = createCanvasCar(id);
    console.log("Handling failure marker for car " + id);
    if (ownership.has(id)){        
        canvas.addEventListener('click', function(event) {
            handleAssistanceCanvasClick(event, canvas, car);
        });

        var popupContent = document.createElement('div');

        drawAssistanceStreet(id);

        popupContent.appendChild(canvas);

         // Create a new popup with a specific maximum width

        var popup = L.popup({maxWidth: canvas.width+50, maxHeight: canvas.height+50}).setContent(popupContent);

        // Bind the popup to the marker
        failureMarker.bindPopup(popup);

        canvas.style.display = 'block'; // Make the canvas visible

        map.on('popupopen', function(e) {
            car = createCanvasCar(id);
        });
        
        failureMarker.openPopup();

    }

    map.setView(failureMarker.getLatLng(), 13);
}

function drawRoute(sampleSeq) {
    sampleSeq.body.read_sample_seq.forEach(
        function(sample, i, samples) {
        // Process metadata
        var validData = sample.read_sample_info.valid_data;
        var instanceHandle = sample.read_sample_info.instance_handle;
        var instanceState  = sample.read_sample_info.instance_state;
        
        console.log("INSIDE DRAW ROUTEEEEEEEEEEEEEE");

        // If we received an invalid data sample, and the instance state
        // is != ALIVE, then the instance has been either disposed or
        // unregistered and we remove the shape from the canvas.
        if (!validData) {
            return false;
        }

        if (instanceState != "ALIVE") {
            return false;
        }

        if (sample) {
            if (carsAlive.has(instanceHandle)) {
                // var current_car = carsAlive.get(instanceHandle);
                if (drawRoutes.has(instanceHandle)){
                    console.log("Removing route of car " + sample.data.id);
                    var polylineToRemove = drawRoutes.get(instanceHandle);
                    polylineToRemove.remove();
                }
                
                var routePoints = [];

                if (sample.data.path.length > 0){
                    for (step in sample.data.path){
                        routePoints.push([sample.data.path[step].lat, sample.data.path[step].lon]);
                    }
                    console.log(routePoints);
    
                    var polyline = L.polyline(routePoints, { color: currentRouteColor.get(instanceHandle) }).addTo(map);
    
                    drawRoutes.set(instanceHandle, polyline);
                }
            }
        }
    });
}

function drawRouteHistorical(sampleSeq) {
    sampleSeq.forEach(function(sample, i, samples) {
        // Process metadata
        var validData = sample.read_sample_info.valid_data;
        var instanceHandle = sample.read_sample_info.instance_handle;
        var instanceState  = sample.read_sample_info.instance_state;

        // If we received an invalid data sample, and the instance state
        // is != ALIVE, then the instance has been either disposed or
        // unregistered and we remove the shape from the canvas.
        if (!validData) {
            console.log("NOT VALID");
            return false;
        }

        if (instanceState != "ALIVE") {
            return false;
        }

        console.log("INSIDE DRAW ROUTE HISTORICAL");

        if (sample) {
            console.log(carsAlive.has(instanceHandle));
            if (carsAlive.has(instanceHandle)) {
                // if (!current_car.arrival && !drawRoutes.has(instanceHandle)) {

                if (!drawRoutes.has(instanceHandle)){       
                    var routePoints = [];

                    for (step in sample.data.path){
                        routePoints.push([sample.data.path[step].lat, sample.data.path[step].lon]);
                    }
                    console.log(routePoints);

                    console.log("PAINTIIIING HISTORICAL");

                    var polyline = L.polyline(routePoints, { color: 'grey' }).addTo(map);

                    drawRoutes.set(instanceHandle, polyline);

                }
            }
        }
    });
}

// General functions

function updateCarList(){
    var carList = document.getElementById('carList');
    carList.innerHTML = "";
    for (let data of carsAlive) {
        var btn = document.createElement('button');
        btn.innerText = "Car " + data[1].id;
        if (failureMarkerMap.has(data[1].id)){
            btn.className = "btn btn-danger car-btn";
        }else{
            btn.className = "btn btn-info car-btn";
        }
        btn.addEventListener('click', function(e) {
            var carMarker = carMarkerMap.get(data[1].id);
            carClickHandler(data[1].id, carMarker);
        });
        var list = document.createElement('ul');
        btn.style.marginRight = '10px';
        var text = document.createElement('p');
        if (users_in_control.has(data[1].id) && users_in_control.get(data[1].id) != "" && users_in_control.get(data[1].id) != undefined){
            text.innerText = 'User: ' + users_in_control.get(data[1].id);
            list.appendChild(text);
        }
        list.appendChild(btn);

        if (ownership.has(data[1].id)){
            if (failureMarkerMap.has(data[1].id)){
                var btn_assist = document.createElement('button');
                btn_assist.innerText = "Assist";
                btn_assist.className = "btn btn-warning car-btn";
                btn_assist.addEventListener('click', function(e) {
                    failureMarkerHandler(data[1].id, failureMarkerMap);
                });
                list.appendChild(btn_assist);
            }

            var release_btn = document.createElement('button');
            release_btn.innerText = "Release Car";
            release_btn.className = "btn btn-success car-btn";
            release_btn.addEventListener('click', function(e) {
                requestControl(user, data[1].id, "RELEASE");
                ownership.delete(data[1].id);
                release_btn.remove();
                var circle = circleMap.get(data[1].id);
                if (circle){
                    circle.remove();
                }
                if (failureMarkerMap.has(data[1].id)){
                    var failureMarker = failureMarkerMap.get(data[1].id);
                    failureMarker.closePopup();
                }
                selectedCar.delete(data[1].id);
                updateCarList();
            });
            release_btn.style.marginRight = '10px';
            list.appendChild(release_btn);
            
        }

        carList.appendChild(list);
    }
}

function login(){
    document.getElementById('loginForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var username = document.getElementById('username').value;
        if (username) {
            user = username
            document.getElementById('loginOverlay').style.display = 'none';
        }
    });
}

function drawAssistanceStreet(id){
    var ctx = canvas.getContext('2d');
    if (canvasCars.has(id)){
        var car = canvasCars.get(id);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fill areas above and below the road with semi-transparent gray
        ctx.fillStyle = 'rgba(200, 128, 128, 0.5)';
        ctx.fillRect(0, 0, canvas.width, 50); // Top gray area
        ctx.fillRect(0, canvas.height - 135, canvas.width, 180); // Bottom gray area

        // Draw polyline path
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (car.path.length > 1) {
            ctx.moveTo(car.path[0].lon, car.path[0].lat);
            for (let i = 1; i < car.path.length; i++) {
                ctx.lineTo(car.path[i].lon, car.path[i].lat);
            }
        }
        ctx.stroke();

        // Draw destination area
        ctx.fillStyle = car.destinationArea.color;
        ctx.fillRect(car.destinationArea.x, car.destinationArea.y, car.destinationArea.width, car.destinationArea.height);

        // Draw obstacles (traffic cones)
        // ctx.fillStyle = 'red';
        // car.obstacles.forEach(obstacle => {
        //     ctx.beginPath();
        //     ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
        //     ctx.fill();
        // });

        // Draw obstacles (traffic cones)
        car.obstacles.forEach(obstacle => {
            // Check if the image is loaded before trying to draw it
            if (obstacleImage.complete) {
                // Instead of drawing a circle, draw the obstacle image
                ctx.drawImage(obstacleImage, obstacle.x - obstacle.radius, obstacle.y - obstacle.radius, obstacle.radius * 2, obstacle.radius * 2);
            } else {
                // If the image is not loaded yet, draw a circle as a placeholder
                ctx.beginPath();
                ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        ctx.drawImage(manholeImage, car.manhole_cover.lon - car.manhole_cover.radius, car.manhole_cover.lat - car.manhole_cover.radius, car.manhole_cover.radius * 2, car.manhole_cover.radius * 2);

        // Draw car with rotation
        ctx.save();
        ctx.translate(car.lon, car.lat);
        ctx.rotate(car.rotation);
        ctx.drawImage(carImage, -car.width / 2, -car.height / 2, car.width, car.height);
        ctx.restore();

        // Move the car along the path if it's moving
        if (car.isMoving) {
            moveCar(car);
        }

        // Check collision with obstacles (traffic cones)
        checkCollisionWithObstacles(car);

        // Check if car reaches destination
        checkDestinationReached(car);

        // Request animation frame to continue drawing
        if (!car.isGameOver || !car.closed) {
            requestAnimationFrame(() => drawAssistanceStreet(id));
        }
    }
}

function handleAssistanceCanvasClick(event, canvas, car) {
    if (!car.isGameOver) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Check if the clicked point is within the allowed area (excluding the top and bottom gray areas)
        if (mouseY > 50 && mouseY < canvas.height - 135 &&
            mouseX > 0 && mouseX < canvas.width) {
            // Add clicked point to the path
            if (car.path.length === 0){
                car.path.push({ lon: car.lon, lat: car.lat });
            }
            car.path.push({ lon: mouseX, lat: mouseY });

            // Update the car's target point
            updateTargetPoint(car);

            // Check if the destination area is reached
            if (car.path.length > 0 && car.path[car.path.length - 1].lon > car.destinationArea.x &&
                car.path[car.path.length - 1].lon < car.destinationArea.x + car.destinationArea.width &&
                car.path[car.path.length - 1].lat > car.destinationArea.y &&
                car.path[car.path.length - 1].lat < car.destinationArea.y + car.destinationArea.height) {
                car.isMoving = true; // Start moving the car
            }
        }
    }
}

// Function to update the car's target point
function updateTargetPoint(car) {
    if (car.path.length > 0) {
        car.targetPoint = car.path[0];
    }
}

function moveCar(car) {
    if (car.targetPoint) {
        // Calculate direction towards the target point
        const dlon = car.targetPoint.lon - car.lon;
        const dlat = car.targetPoint.lat - car.lat;
        const distance = Math.sqrt(dlon * dlon + dlat * dlat);

        // Move car towards the target point
        if (distance > car.speed) {
            car.lon += dlon / distance * car.speed;
            car.lat += dlat / distance * car.speed;
        } else {
            // Remove the reached point from the path
            car.path.shift();
            updateTargetPoint(car);
        }

        // Update car rotation angle
        car.rotation = Math.atan2(dlat, dlon);
    }
}

// Function to check collision with obstacles (traffic cones)
function checkCollisionWithObstacles(car) {
    for (let i = 0; i < car.obstacles.length; i++) {
        const obstacle = car.obstacles[i];
        const dlon = car.lon - obstacle.x;
        const dlat = car.lat - obstacle.y;
        const distance = Math.sqrt(dlon * dlon + dlat * dlat);
        if (distance < car.width / 2 + obstacle.radius/2) {
            // Collision with obstacle detected, game over
            car.isGameOver = true;
            console.log("Game Over! You hit a traffic cone.");
            var marker = failureMarkerMap.get(car.id);
            if (marker){
                marker.closePopup();
            }
            alert("You hit a traffic cone in the simulitacion, try again!");
            car = createCanvasCar(car.id);
            return;
        }
    }
}

// Function to check if car reaches destination
function checkDestinationReached(car) {
    var carCenterX = car.lon + car.width / 2;
    var carCenterY = car.lat + car.height / 2;

    if (!car.isGameOver && car.path.length === 0 &&
        carCenterX > car.destinationArea.x &&
        carCenterX < car.destinationArea.x + car.destinationArea.width &&
        carCenterY > car.destinationArea.y &&
        carCenterY < car.destinationArea.y + car.destinationArea.height) {
        // Car reached destination, game won
        car.isGameOver = true;
        console.log("Congratulations! You reached the destination.");
        sendAssistance(car.id);
        var marker = failureMarkerMap.get(car.id);
        if (marker){
            marker.closePopup();
        }
        canvasCars.delete(car.id);
    }
}

function createCanvasCar(id){
    var car = {
        id: id,
        lon: 50,    // Initial position
        lat: canvas_height / 2,
        width: 100,              // Car width
        height: 50,             // Car 
        speed: 2,                // Movement speed
        path: [],                // User-defined polyline path
        targetPoint: null,       // Current target point for the car
        destinationArea: {       // Destination area
            x: canvas_width - 190,
            y: canvas_height / 2 - 50,
            width: 190,
            height: 100,
            color: 'rgba(128, 250, 128, 0.5)'      // Color of the destination area
        },
        obstacles: [             // Array of obstacle objects (traffic cones)
            // vertical line of 3 cones
    
            { x: 230, y: 210, radius: 10 },
            { x: 260, y: 175, radius: 10 },
            // straigth line of 3 cones
            { x: 330, y: 150, radius: 10 },
            // return vertical line
            { x: 400, y: 175, radius: 10 },
            { x: 430, y: 210, radius: 10 },
    
            
    
    
            // Add more obstacles as needed
        ],
        manhole_cover: { x: 330, y: 200, radius: 30 }, 
        isGameOver: false,       // Flag to indicate game over state
        isMoving: false,         // Flag to indicate if the car is moving
        rotation: 0,              // Initial rotation angle of the car
        closed: false
    };
    
    canvasCars.set(id, car);

    return car;
}