import React, { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import './MultiWOZGraph.css';

const MultiWOZGraph = () => {
  const [graphData, setGraphData] = useState(null);
  const [domain, setDomain] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphStats, setGraphStats] = useState(null);
  const svgRef = useRef(null);
  
  // 데이터 불러오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Flask 백엔드 API에서 데이터 가져오기
        const response = await fetch(`http://localhost:5000/api/graph/${domain}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        setGraphData(data);
        
        // 그래프 통계 계산
        if (data && data.nodes && data.links) {
          const stats = calculateGraphStats(data);
          setGraphStats(stats);
        }
        
        setError(null);
      } catch (err) {
        console.error("Error fetching graph data:", err);
        setError(`데이터 로딩 오류: ${err.message}`);
        
        // 개발 테스트용: 백엔드 연결 안 될 경우 더미 데이터 사용
        const dummyData = generateDummyData();
        setGraphData(dummyData);
        
        // 더미 데이터에 대한 통계 계산
        const stats = calculateGraphStats(dummyData);
        setGraphStats(stats);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [domain]);
  
  // 그래프 통계 계산 함수
  const calculateGraphStats = (data) => {
    const stateNodes = data.nodes.filter(node => node.type === 'state');
    const actionNodes = data.nodes.filter(node => node.type === 'action');
    
    // 도메인별 노드 개수
    const domainCounts = {};
    data.nodes.forEach(node => {
      if (node.domain) {
        domainCounts[node.domain] = (domainCounts[node.domain] || 0) + 1;
      }
    });
    
    // 가장 많은 연결을 가진 노드 찾기
    let maxConnections = 0;
    let mostConnectedNode = null;
    
    const nodeLinkCounts = {};
    data.links.forEach(link => {
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      
      nodeLinkCounts[source] = (nodeLinkCounts[source] || 0) + 1;
      nodeLinkCounts[target] = (nodeLinkCounts[target] || 0) + 1;
    });
    
    Object.entries(nodeLinkCounts).forEach(([nodeId, count]) => {
      if (count > maxConnections) {
        maxConnections = count;
        mostConnectedNode = nodeId;
      }
    });
    
    return {
      totalNodes: data.nodes.length,
      totalLinks: data.links.length,
      stateCount: stateNodes.length,
      actionCount: actionNodes.length,
      domainCounts,
      mostConnectedNode,
      maxConnections
    };
  };
  
  // 그래프 렌더링
  useEffect(() => {
    if (!graphData || !svgRef.current) return;
    
    const width = 900;
    const height = 700;
    
    // SVG 초기화
    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])
      .attr('style', 'max-width: 100%; height: auto;');
    
    svg.selectAll("*").remove();
    
    // 줌 기능 추가
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);
    
    // 메인 그래프 그룹
    const g = svg.append("g");
    
    // 노드 데이터 처리
    const nodes = graphData.nodes.map(node => ({...node}));
    
    // 링크 데이터 처리 (문자열 ID를 객체 참조로 변환)
    const links = graphData.links.map(link => {
      // 소스와 타겟이 객체인 경우 id를 추출
      const source = typeof link.source === 'string' ? link.source : link.source.id;
      const target = typeof link.target === 'string' ? link.target : link.target.id;
      
      return {
        source,
        target,
        weight: link.weight || 1
      };
    });
    
    // 시뮬레이션 설정
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => 150 / (Math.sqrt(d.weight) || 1)))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60));
    
    // 화살표 정의
    g.append('defs').selectAll('marker')
      .data(['end'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 30)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999');
    
    // 링크(엣지) 그리기 - 가중치에 따른 두께 적용
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => Math.min(Math.max(Math.sqrt(d.weight) * 0.5, 1), 5))
      .attr('marker-end', 'url(#arrow)');
    
    // 노드 그룹 생성
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));
    
    // 노드 모양 그리기 (상태는 사각형, 행동은 원형/타원형)
    node.append('rect')
      .attr('x', d => d.type === 'state' ? -65 : -75)
      .attr('y', -25)
      .attr('width', d => d.type === 'state' ? 130 : 150)
      .attr('height', 50)
      .attr('rx', d => d.type === 'state' ? 5 : 25)
      .attr('ry', d => d.type === 'state' ? 5 : 25)
      .attr('fill', d => d.color || (d.type === 'state' ? 'lightblue' : 'lightgray'))
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5);
    
    // 노드 라벨 추가
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 5)
      .attr('font-size', '12px')
      .text(d => d.label || d.id)
      .call(wrap, 120);  // 긴 텍스트 래핑
    
    // 툴팁 추가 - 더 자세한 정보 포함
    node.append('title')
      .text(d => {
        const connections = links.filter(link => 
          link.source === d.id || (typeof link.source === 'object' && link.source.id === d.id) ||
          link.target === d.id || (typeof link.target === 'object' && link.target.id === d.id)
        ).length;
        
        return `${d.id}\nType: ${d.type}${d.domain ? `\nDomain: ${d.domain}` : ''}` + 
               `\nConnections: ${connections}`;
      });
    
    // 시뮬레이션 이벤트 핸들러
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    // 드래그 이벤트 핸들러
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    
    // 텍스트 래핑 함수
    function wrap(text, width) {
      text.each(function() {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word;
        let line = [];
        let lineNumber = 0;
        const lineHeight = 1.1;
        const y = text.attr("y");
        const dy = parseFloat(text.attr("dy"));
        let tspan = text.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
        
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if (tspan.node().getComputedTextLength() > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
        }
      });
    }
    
  }, [graphData]);
  
  // 개발 테스트용 더미 데이터 생성 함수
  const generateDummyData = () => {
    const domains = ['hotel', 'restaurant', 'train', 'attraction', 'taxi'];
    const nodes = [
      { id: 'start', label: 'Start', type: 'state', color: 'green' },
      { id: 'end', label: 'End', type: 'state', color: 'red' },
      { id: 'greeting', label: 'Greeting', type: 'action', color: 'lightgray' },
      { id: 'goodbye', label: 'Goodbye', type: 'action', color: 'lightgray' }
    ];
    
    const links = [
      { source: 'start', target: 'greeting', weight: 5 },
      { source: 'end', target: 'goodbye', weight: 5 }
    ];
    
    // 기본 도메인 그래프 생성
    domains.forEach(domain => {
      // 상태 노드 추가
      nodes.push({ id: `${domain}_active`, label: `${domain} Active`, type: 'state', color: 'lightblue', domain });
      nodes.push({ id: `${domain}_booking`, label: `${domain} Booking`, type: 'state', color: 'lightblue', domain });
      nodes.push({ id: `${domain}_booked`, label: `${domain} Booked`, type: 'state', color: 'lightgreen', domain });
      
      // 행동 노드 추가
      nodes.push({ id: `${domain}-request`, label: `${domain} Request`, type: 'action', color: 'yellow', domain });
      nodes.push({ id: `${domain}-inform`, label: `${domain} Inform`, type: 'action', color: 'lightpink', domain });
      nodes.push({ id: `${domain}-book`, label: `${domain} Book`, type: 'action', color: 'purple', domain });
      
      // 대표적인 상태-슬롯 노드 추가
      const slots = {
        'hotel': ['price', 'type', 'area', 'stars', 'parking'],
        'restaurant': ['price', 'food', 'area', 'name', 'time'],
        'train': ['departure', 'destination', 'day', 'time'],
        'attraction': ['type', 'area', 'name'],
        'taxi': ['departure', 'destination', 'time']
      };
      
      // 주요 슬롯 2개만 선택
      const domainSlots = slots[domain] || ['name', 'type'];
      const mainSlots = domainSlots.slice(0, 2);
      
      mainSlots.forEach(slot => {
        nodes.push({ 
          id: `${domain}_${slot}_filled`, 
          label: `${domain} ${slot} Filled`, 
          type: 'state', 
          color: 'lightblue', 
          domain 
        });
        
        // 슬롯별 요청 행동 추가
        nodes.push({ 
          id: `${domain}-request-${slot}`, 
          label: `${domain} Request ${slot}`, 
          type: 'action', 
          color: 'yellow', 
          domain 
        });
      });
      
      // 링크 추가 (가중치 추가)
      links.push({ source: 'greeting', target: `${domain}_active`, weight: 2 });
      
      mainSlots.forEach(slot => {
        links.push({ 
          source: `${domain}_active`, 
          target: `${domain}-request-${slot}`, 
          weight: 3 
        });
        
        links.push({ 
          source: `${domain}-request-${slot}`, 
          target: `${domain}_${slot}_filled`, 
          weight: 3 
        });
      });
      
      links.push({ 
        source: `${domain}_${mainSlots[0]}_filled`, 
        target: `${domain}_${mainSlots[1]}_filled`, 
        weight: 2 
      });
      
      links.push({ 
        source: `${domain}_${mainSlots[1]}_filled`, 
        target: `${domain}-inform`, 
        weight: 2 
      });
      
      links.push({ 
        source: `${domain}-inform`, 
        target: `${domain}_booking`, 
        weight: 2 
      });
      
      links.push({ 
        source: `${domain}_booking`, 
        target: `${domain}-book`, 
        weight: 3 
      });
      
      links.push({ 
        source: `${domain}-book`, 
        target: `${domain}_booked`, 
        weight: 3 
      });
      
      links.push({ 
        source: `${domain}_booked`, 
        target: 'end', 
        weight: 2 
      });
    });
    
    // 멀티 도메인 상태 추가
    const multiDomains = ['hotel_restaurant', 'train_hotel', 'restaurant_attraction'];
    
    multiDomains.forEach(multiDomain => {
      const domains = multiDomain.split('_');
      
      nodes.push({ 
        id: `multi_domain_${multiDomain}`, 
        label: `Multi Domain ${domains[0]} ${domains[1]}`, 
        type: 'state', 
        color: 'purple' 
      });
      
      links.push({ 
        source: `${domains[0]}_booked`, 
        target: `multi_domain_${multiDomain}`, 
        weight: 1 
      });
      
      links.push({ 
        source: `multi_domain_${multiDomain}`, 
        target: `${domains[1]}_active`, 
        weight: 1 
      });
    });
    
    return { nodes, links };
  };
  
  return (
    <div className="multiwoz-graph-container">
      <div className="controls">
        <h2>MultiWOZ 상태-행동 공간</h2>
        <div className="domain-selector">
          <label htmlFor="domain-select">도메인 선택:</label>
          <select 
            id="domain-select" 
            value={domain} 
            onChange={(e) => setDomain(e.target.value)}
            disabled={loading}
          >
            <option value="all">전체 도메인</option>
            <option value="hotel">Hotel</option>
            <option value="restaurant">Restaurant</option>
            <option value="train">Train</option>
            <option value="attraction">Attraction</option>
            <option value="taxi">Taxi</option>
            <option value="hospital">Hospital</option>
            <option value="police">Police</option>
          </select>
        </div>
        
        {graphStats && (
          <div className="graph-stats">
            <h3>그래프 통계</h3>
            <div className="stat-item">
              <span className="stat-label">총 노드:</span>
              <span className="stat-value">{graphStats.totalNodes}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">상태 노드:</span>
              <span className="stat-value">{graphStats.stateCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">행동 노드:</span>
              <span className="stat-value">{graphStats.actionCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">연결 관계:</span>
              <span className="stat-value">{graphStats.totalLinks}</span>
            </div>
            {graphStats.mostConnectedNode && (
              <div className="stat-item">
                <span className="stat-label">가장 많이 연결된 노드:</span>
                <span className="stat-value">{graphStats.mostConnectedNode} ({graphStats.maxConnections}연결)</span>
              </div>
            )}
          </div>
        )}
        
        <div className="legend">
          <h3>범례</h3>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'green'}}></span>
            <span>시작 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'red'}}></span>
            <span>종료 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'lightblue'}}></span>
            <span>일반 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'orange'}}></span>
            <span>결과 없음 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'lightgreen'}}></span>
            <span>예약 완료 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'purple'}}></span>
            <span>멀티 도메인 상태</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'yellow'}}></span>
            <span>요청 행동</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'lightpink'}}></span>
            <span>정보 제공/추천 행동</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{backgroundColor: 'purple'}}></span>
            <span>예약 행동</span>
          </div>
        </div>
        
        <div className="instructions">
          <p>드래그하여 노드 이동, 휠로 확대/축소, 노드 위에 마우스를 올려 상세 정보 확인</p>
          <p>링크 두께는 전이 빈도를 나타냅니다.</p>
        </div>
      </div>
      
      <div className="graph-container">
        {loading && <div className="loading">로딩 중...</div>}
        {error && <div className="error">{error}</div>}
        <svg ref={svgRef} className="graph"></svg>
      </div>
    </div>
  );
};

export default MultiWOZGraph;