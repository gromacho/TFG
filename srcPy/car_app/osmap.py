from queue import Queue

import networkx as nx
import osmnx as ox

class Map:
    def __init__(self):
        self.graph = ox.graph_from_place("Granada, Spain", network_type="drive")

    def getRoute(self, origin, destination):
        origin = tuple(map(float, origin.split(",")))
        destination = tuple(map(float, destination.split(",")))

        start_node = ox.nearest_nodes(self.graph, origin[0], origin[1])
        end_node = ox.nearest_nodes(self.graph, destination[0], destination[1])

        route = nx.shortest_path(self.graph, start_node, end_node, weight="length")
        distance = nx.shortest_path_length(self.graph, start_node, end_node, weight="length")

        coordinates = [
            (self.graph.nodes[node]["x"], self.graph.nodes[node]["y"]) for node in route
        ]

        coordinates.insert(0, origin)

        return coordinates, distance

# TODO: Check if it works
    def block_street(self, coord1, coord2):
        node1 = ox.nearest_nodes(self.graph, coord1[0], coord1[1])
        node2 = ox.nearest_nodes(self.graph, coord2[0], coord2[1])

        if self.graph.has_edge(node1, node2):
            self.graph.remove_edge(node1, node2)

    def resetMap(self):
        self.graph = ox.graph_from_place("Granada, Spain", network_type="drive")
