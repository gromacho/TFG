
# WARNING: THIS FILE IS AUTO-GENERATED. DO NOT MODIFY.

# This file was generated from maps_types.idl
# using RTI Code Generator (rtiddsgen) version 4.2.0.
# The rtiddsgen tool is part of the RTI Connext DDS distribution.
# For more information, type 'rtiddsgen -help' at a command shell
# or consult the Code Generator User's Manual.

from dataclasses import field
from typing import Sequence, Optional
import rti.idl as idl
from enum import IntEnum


@idl.struct
class position:
    lon: float = 0.0
    lat: float = 0.0

@idl.struct(
    member_annotations = {
        'id': [idl.key, ],
    }
)
class car_info:
    id: idl.int32 = 0
    current_position: position = field(default_factory = position)
    angle: float = 0.0
    arrival: bool = False
    user_in_control: Optional[str] = None
    rpm: idl.float32 = 0.0
    kph: idl.float32 = 0.0
    litersFuel: idl.float32 = 0.0
    kmPerLiter: idl.float32 = 0.0
    rangeKm: idl.float32 = 0.0
    headingDegreesNorth: idl.float32 = 0.0
    gear: idl.int32 = 0
    isEngineHot: bool = False
    isFuelLow: bool = False
    isParkingBrakeOn: bool = False
    isAbsActive: bool = False
    isParkingLightsOn: bool = False
    isIceDetected: bool = False
    isUnbeltedPassenger: bool = False

@idl.struct(
    member_annotations = {
        'id': [idl.key, ],
    }
)
class command:
    id: idl.int32 = 0
    destination: position = field(default_factory = position)

@idl.struct(
    member_annotations = {
        'id': [idl.key, ],
        'path': [idl.bound(100)],
    }
)
class route:
    id: idl.int32 = 0
    path: Sequence[position] = field(default_factory = list)

@idl.struct(
    member_annotations = {
        'id_car': [idl.key, ],
    }
)
class failure_assistance:
    id_car: idl.int32 = 0
    need_asistance: bool = False

@idl.struct
class street_closed:
    start_street: position = field(default_factory = position)
    end_street: position = field(default_factory = position)

@idl.enum
class car_aviability(IntEnum):
    AVAILABLE = 0
    BUSY = 1
    FAIL = 2

@idl.enum
class request_type(IntEnum):
    CONTROL = 0
    RELEASE = 1

@idl.struct(
    member_annotations = {
        'id_user': [idl.key, idl.bound(255)],
    }
)
class request_control:
    id_user: str = ""
    id_car: idl.int32 = 0
    request: request_type = request_type.CONTROL

@idl.struct(
    member_annotations = {
        'id_user': [idl.key, idl.bound(255)],
    }
)
class replay_control:
    id_user: str = ""
    id_car: idl.int32 = 0
    replay: car_aviability = car_aviability.AVAILABLE

@idl.struct(
    member_annotations = {
        'id_car': [idl.key, ],
        'username': [idl.bound(255)],
    }
)
class user_info:
    id_car: idl.int32 = 0
    username: str = ""
