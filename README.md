# MAPS DEMO

In this Demo we represent the Remote Driving Teleoperation Use Case where some autonomous cars(simulated) are driving and sometimes they need remote assistance in edge cases.

![Architecture](../resources/imgs/INTERN-69:TFG.png)

## Components
Inside this project you can find 3 parts:
    - Kubernetes Deployment
    - Simulated Car
    - Fleet Managment Service



## Kubernetes

Inside the Kubernetes folder you can find a script and all the needed files to create the two clusters. Running the script and having kubectl configured correctly everythin should work fine, but you can also run each yaml file individually changing the needed parametrets.

It is important to mention that the script and the folder structure is made to use helm, so you need to have it installed previously.

```bash
# Deploy the both cluster with all the pods and services
$./automation.sh
```

### ConfigMaps and Secrets
Before launch any type of RTI software into Kubernetes we need to set a configmaps for the RTI license, CDS configuration and a secret for the Docker Hub login in order to pull the image. 

```bash
# Creation of the configmap with your own rti license
$kubectl create configmap rti-license --from-file=/home/user/rti_license.dat
```
Be careful with the rti_license.dat route; use your own route.

```bash
# Creation of the configmap with the cds configuration
$kubectl create configmap cds-config --from-file=cds-config.xml
```
Cloud Discovery Service will use a specific configuration for the WAN transport, you can check it on the cds-config.xml file.

We also have to create a configmap for the routing service, but it needs some modifications with the IPs of the other components; so we will first deploy them before create the configmap.


```bash
# Creation of the secret with the docker hub credentials
$kubectl create secret docker-registry docker-hub \
— docker-username=DOCKER_USER \
— docker-password=DOCKER_PASSWORD \
— docker-email=DOCKER_EMAIL 
```

After the creation of that secret, the pods will be able to pull images form Docker Hub.

### Cloud Discovery Service Deploy
First of all we have to deploy the CDS service LoadBalancer. After that will be able to check the assigned IP and use it in the CDS config.

```bash
# Deploy the CDS LoadBalancer
$kubectl apply -f cds_service.yaml
```
```bash
# To check if everything has worked well and check the LoadBalancer IP.
$kubectl get all
NAME                       TYPE           CLUSTER-IP       EXTERNAL-IP                                                                     PORT(S)           AGE
service/cds-service        LoadBalancer   10.100.150.206   aa9e4c0d79a1b4368a848939e8598485-1664524f76af4ec5.elb.eu-west-3.amazonaws.com   7400:32534/UDP    5h52m
service/kubernetes         ClusterIP      10.100.0.1       <none>                                                                          443/TCP           6h5m

```

Now that we know the Public IP assigned and the port (we have configured it in the cds_service.yaml and attached it to the CDS port), we can change the envs in the cds_deployment.yaml file before deploying it.

```yaml
- name: CDS_PUBLIC_IP # IP that must be changed after the LoadBalancer deployment
  value: "aa9e4c0d79a1b4368a848939e8598485-1664524f76af4ec5.elb.eu-west-3.amazonaws.com"
```

Once that everything is configured, we can deploy the CDS pod.

```bash
$kubectl apply -f cds_deployment.yaml
```

You have to wait a few seconds to see if the deployment is ready. In case of error, you can check it with.

```bash
$kubectl get all

$kubectl describe pod cds-0

$kubectl logs cds-0
```
In fact, if you have chosen to run cds with any verbosity you will be able to see it through the kubectl logs command.

Until here we have the same deploy inside the cluster as in the cds_cloud example.

### Cloud Discovery Service Local Deploy
This CDS will work with the default configuration, that means that we do not have to upload any config file or export any variable or have any type of LoadBalancer. You can check it in the cds_local_deployment.yaml

```bash
# To create the cds local pod.
$kubectl apply -f cds_local_deployment.yaml
```
Now we have to check the internal IP of the cds local in order to add it in the routing service.

```bash
$ kubectl get pods -o wide
# With this command we can see the IPs of the pods.
NAME          READY   STATUS    RESTARTS   AGE     IP              NODE                                           NOMINATED NODE   READINESS GATES
cds-0         1/1     Running   0          49s     192.168.34.4    ip-192-168-36-243.eu-west-3.compute.internal   <none>           <none>
cds-local-0   1/1     Running   0          4m45s   192.168.39.85   ip-192-168-36-243.eu-west-3.compute.internal   <none>           <none>
```

In this case, the cds-local internal IP is 192.168.34.4.

### Routing Service Deploy, LoadBalancer and Routing config
Now that we know the IPs of both CDS, we can change the config file. Routing Service has UDPv4_WAN communication with the CDS with public IP and UDPv4 communication with the local CDS.

We have to change the routingconfig.xml file in the sections for initial peers in participants 1 and 2.

```xml
<!-- Particant 1 -->
<initial_peers>
    <element>
    rtps@udpv4_wan://aa9e4c0d79a1b4368a848939e8598485-1664524f76af4ec5.elb.eu-west-3.amazonaws.com:7400 <!-- Change it for the public IP of the CDS.  -->
    </element>
</initial_peers>
```

Now the participant 1 is set to the CDS public IP.

```xml
<!-- Particant 2 -->
<initial_peers>
    <element>
    rtps@udpv4_wan://192.168.39.85:7400 <!-- Change it for the local CDS IP.  -->
    </element>
</initial_peers>
```

Now the participant 2 is set to the local CDS IP.

```bash
# Creation of the configmap with the routing configuration
$kubectl create configmap routing-config --from-file=routing-config.xml
```

Once that the routing config has set the initial peers and we have created the configmap, we can deploy the LoadBalancer in order to check the public IP and add it to the routing_deploymnet.yaml.

```bash
# To create the routing LoadBalancer
$ kubectl apply -f routing_service.yaml
```
Now we have to check the assigned IP to routing LoadBalancer.

```bash
# To check if everything has worked well and check the LoadBalancer IP.
$ kubectl get all
NAME              READY   STATUS    RESTARTS   AGE
pod/cds-0         1/1     Running   0          77m
pod/cds-local-0   1/1     Running   0          81m

NAME                      TYPE           CLUSTER-IP      EXTERNAL-IP                                                                     PORT(S)           AGE
service/cds-service       LoadBalancer   10.100.39.161   aa9e4c0d79a1b4368a848939e8598485-1664524f76af4ec5.elb.eu-west-3.amazonaws.com   7400:30291/UDP    81m
service/kubernetes        ClusterIP      10.100.0.1      <none>                                                                          443/TCP           3h33m
service/routing-service   LoadBalancer   10.100.59.55    a11d46897ccf548a880cb927b35c7418-781fa3ce1fc7318f.elb.eu-west-3.amazonaws.com   16000:31076/UDP   5s

NAME                         READY   AGE
statefulset.apps/cds         1/1     3h22m
statefulset.apps/cds-local   1/1     81m
```

The IP assigned to the routing LoadBalancer in this case is a11d46897ccf548a880cb927b35c7418-781fa3ce1fc7318f.elb.eu-west-3.amazonaws.com.

With this IP we have to modify routing_deploymnet.yaml

```yaml
- env:
    - name: PUBLIC_IP
        value: "a11d46897ccf548a880cb927b35c7418-781fa3ce1fc7318f.elb.eu-west-3.amazonaws.com"
```

Finally we are ready to deploy the routing service pod.

```bash
# To create the routing service pod
$ kubectl apply -f routing_deployment.yaml
```

You can check if everything is working fine with these commands.

```bash
$kubectl get all

$kubectl describe pod routing-0

$kubectl logs routing-0
```

### Subscriber Deploy
This is the last piece inside the Cluster. In this case we are using a modified image of connext_sdk with some basic tests inside; you should be able to pull it with the observability account.
We only need the set the initial peers to the cds local in the subscriber_deployment.yaml and lauch it.
The messages will be visible through the kubectl logs subscriber-0 command.

```yaml
env:
    - name: NDDS_DISCOVERY_PEERS
      value: "rtps@udpv4://192.168.39.85:7400"
```

I have added the CDS local IP.

```bash
# To create the subscriber pod
$ kubectl apply -f subscriber_deploymnet.yaml
```

Now the subscriber is running and you can see it messages thought kubectl logs sub-0 ????? NOT SURE

### Cluster checks

Everything is set inside the cluster, you can check the logs in both CDS to check if they have discover the other elements (kubectl logs...).

For now the CDS with external IP should have discovered the routing service (it will appear with its external IP). And the local CDS will have discovered the routing service (it will appear with its internal IP) and the subscriber (also with its internal IP).

Remember that you can check the external IPs with:

```bash
# Check information about services and pods
$ kubectl get all
NAME              READY   STATUS    RESTARTS   AGE
pod/cds-0         1/1     Running   0          77m
pod/cds-local-0   1/1     Running   0          81m

NAME                      TYPE           CLUSTER-IP      EXTERNAL-IP                                                                     PORT(S)           AGE
service/cds-service       LoadBalancer   10.100.39.161   aa9e4c0d79a1b4368a848939e8598485-1664524f76af4ec5.elb.eu-west-3.amazonaws.com   7400:30291/UDP    81m
service/kubernetes        ClusterIP      10.100.0.1      <none>                                                                          443/TCP           3h33m
service/routing-service   LoadBalancer   10.100.59.55    a11d46897ccf548a880cb927b35c7418-781fa3ce1fc7318f.elb.eu-west-3.amazonaws.com   16000:31076/UDP   5s

NAME                         READY   AGE
statefulset.apps/cds         1/1     3h22m
statefulset.apps/cds-local   1/1     81m

$ nslookup a11d46897ccf548a880cb927b35c7418-781fa3ce1fc7318f.elb.eu-west-3.amazonaws.com
Server:		127.0.0.53
Address:	127.0.0.53#53

Non-authoritative answer:
Name:	a11d46897ccf548a880cb927b35c7418-781fa3ce1fc7318f.elb.eu-west-3.amazonaws.com
Address: 52.47.78.31
```
I have run nslookup to the routing LoadBalancer direction, and it has answered me with the resolved public IP 52.47.78.31. Keep in mind that if you have deployed the LoadBalancer recently you may have to wait some minutes in order DNS tables to be updated. 

Also, keep in mind that nslookup may answer with 3 public IPs, that is because of the nature of EKS LoadBalancers that are created with 3 public subnets for default.

Remember that you can check the internal IPs with:

```bash
# Check internal pods IPs in the cluster
$ kubectl get pods -o wide
NAME          READY   STATUS    RESTARTS   AGE    IP               NODE                                           NOMINATED NODE   READINESS GATES
cds-0         1/1     Running   0          19h    192.168.34.4     ip-192-168-36-243.eu-west-3.compute.internal   <none>           <none>
cds-local-0   1/1     Running   0          19h    192.168.39.85    ip-192-168-36-243.eu-west-3.compute.internal   <none>           <none>
routing-0     1/1     Running   0          12s    192.168.34.195   ip-192-168-36-243.eu-west-3.compute.internal   <none>           <none>
sub-0         1/1     Running   0          104s   192.168.55.75    ip-192-168-36-243.eu-west-3.compute.internal   <none>           <none>
``` 

Here you can see the IP of each of the four pods that we have deployed.


### Publisher
The files that you need to compile and rune the Publisher test are in test folder. You can fine the ReadMe for a x64Linux4gcc7.3.0 architecture.
If you have another architecture you can search how to compile those files or use the connext_sdk image that we use in the subscriber in a local container.

Once that you have compile the code, you will have a new obj folder; for run the publisher:

```bash
# Running the publisher
$ ./obj/x64Linux4gcc7.3.0/test_publisher 1
```

The flag 1 indicates the domain in where this publisher is writing; for this example is 1 since routing service is in charge of send it to the subscriber in the domain 0.

