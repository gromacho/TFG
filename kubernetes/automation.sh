# Change this variables if you want other names for the clusters
CLUSTER1=cluster1
CLUSTER2=cluster2

# Change this variable if you want to increase the num of simulated cars
NUM_REPLICAS=3

# # Creation of the clusters in parallel
# eksctl create cluster -n $CLUSTER1 --region eu-west-3 --node-type t3.medium -N 1 &
# PID1=$!
# eksctl create cluster -n $CLUSTER2 --region eu-west-3 --node-type t3.medium -N 1 &
# PID2=$!

# # Wait for both processes to finish
# wait $PID1 $PID2

# Asing the kubectl config file to the first cluster
eksctl utils write-kubeconfig --cluster=$CLUSTER1

# Creation of the needed files in the cluster
kubectl apply -f dockerhub-secret.yaml
kubectl create configmap routing-config --from-file=routing-config.xml
kubectl create configmap rti-license --from-file=/home/gromacho/rti_license.dat

# Creation of the services (LoadBalancers and Cluster IP)
helm install services Services/

# Waiting until the IPs are assigned by AWS
LOAD_BALANCER_IP=""
CLUSTER_IP=""
while [ -z $LOAD_BALANCER_IP ]; do
  sleep 10
  LOAD_BALANCER_IP=$(kubectl get svc routing-service -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
done

echo "Load Balancer IP: $LOAD_BALANCER_IP"

while [ -z $FIRST_IP ]; do
  sleep 1
  NSLOOKUP_OUTPUT=$(nslookup $LOAD_BALANCER_IP)
  FIRST_IP=$(echo "$NSLOOKUP_OUTPUT" | awk '/^Address: / { print $2; exit }')
done

echo "First IP: $FIRST_IP"

while [ -z $CLUSTER_IP ]; do
  sleep 1
  CLUSTER_IP=$(kubectl get svc cds-local-clusterip -o jsonpath='{.spec.clusterIP}')
done

echo "Cluster IP: $CLUSTER_IP"

while [ -z $WEB_INT_IP ]; do
  sleep 1
  WEB_INT_IP=$(kubectl get svc wis-service-http -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
done

echo "wEBiNT IP: $WEB_INT_IP"

export ROUTING_LB=$FIRST_IP

export CLUSTER_IP=rtps@udpv4://$CLUSTER_IP:7400

# Creation of all the MapsDemo components left whit the IPs needed resolved.
helm install mapsdemo ./MapsDemo --set ROUTING_LB=$ROUTING_LB --set CDS_CLUSTER_IP=$CLUSTER_IP

# Asing the kubectl config file to the second cluster
eksctl utils write-kubeconfig --cluster=$CLUSTER2

# Creation of the needed files
kubectl apply -f dockerhub-secret.yaml
kubectl create configmap rti-license --from-file=/home/gromacho/rti_license.dat

export CAR_INITIAL_PEERS=rtps@udpv4_wan://$LOAD_BALANCER_IP:16000

# Creation of the Car replicas on the second cluster
helm install cars Cars/ --set CAR_INITIAL_PEERS=$CAR_INITIAL_PEERS --set NUM_REPLICAS=$NUM_REPLICAS

# Waiting until the IP to the Web Integration Service is resolved
until curl --output /dev/null --silent --head --fail "$WEB_INT_IP:8080"; do
    printf '.'
    sleep 5
done

# Open the URL in a web browser
xdg-open "http://$WEB_INT_IP:8080/maps_webint/js/index.html"